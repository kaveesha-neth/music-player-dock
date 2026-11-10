param([Parameter(Mandatory=$true)][string]$ExecutablePath,[Parameter(Mandatory=$true)][string]$IconPath,[switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release')) + [IO.Path]::DirectorySeparatorChar
$targetExe = [IO.Path]::GetFullPath($ExecutablePath)
if (-not $targetExe.StartsWith($releaseRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Icon updates are restricted to this project release directory.' }
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class DockIconResources {
 delegate bool NameCallback(IntPtr module,IntPtr type,IntPtr name,IntPtr param);
 delegate bool LanguageCallback(IntPtr module,IntPtr type,IntPtr name,ushort language,IntPtr param);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr LoadLibraryEx(string path,IntPtr file,uint flags);
 [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool EnumResourceNames(IntPtr module,IntPtr type,NameCallback callback,IntPtr param);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool EnumResourceLanguages(IntPtr module,IntPtr type,IntPtr name,LanguageCallback callback,IntPtr param);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr BeginUpdateResource(string path,bool remove);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool UpdateResource(IntPtr update,IntPtr type,IntPtr name,ushort language,byte[] data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool EndUpdateResource(IntPtr update,bool discard);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindResourceEx(IntPtr module,IntPtr type,IntPtr name,ushort language);
 [DllImport("kernel32.dll")] static extern IntPtr LoadResource(IntPtr module,IntPtr resource);
 [DllImport("kernel32.dll")] static extern IntPtr LockResource(IntPtr resource);
 [DllImport("kernel32.dll")] static extern uint SizeofResource(IntPtr module,IntPtr resource);
 class Resource {public ushort Type,Language;public int Id;public string Name;}
 static byte[][] Images(byte[] ico) {
  if(ico.Length<6||BitConverter.ToUInt16(ico,0)!=0||BitConverter.ToUInt16(ico,2)!=1)throw new InvalidDataException("Not a Windows icon");
  int count=BitConverter.ToUInt16(ico,4);if(count<1||ico.Length<6+count*16)throw new InvalidDataException("Invalid icon directory");
  var result=new byte[count][];
  for(int i=0;i<count;i++){int entry=6+i*16;uint size=BitConverter.ToUInt32(ico,entry+8),offset=BitConverter.ToUInt32(ico,entry+12);if(size==0||(ulong)offset+size>(ulong)ico.Length)throw new InvalidDataException("Invalid icon frame");result[i]=new byte[(int)size];Buffer.BlockCopy(ico,(int)offset,result[i],0,(int)size);}
  return result;
 }
 static byte[] Group(byte[] ico,int count){using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){writer.Write((ushort)0);writer.Write((ushort)1);writer.Write((ushort)count);for(int i=0;i<count;i++){writer.Write(ico,6+i*16,12);writer.Write((ushort)(i+1));}return stream.ToArray();}}
 static void Put(IntPtr update,ushort type,IntPtr name,ushort language,byte[] data){if(!UpdateResource(update,new IntPtr(type),name,language,data,data==null?0:(uint)data.Length))throw new Win32Exception(Marshal.GetLastWin32Error());}
 static byte[] Read(IntPtr module,ushort type,ushort id){var resource=FindResourceEx(module,new IntPtr(type),new IntPtr(id),0);if(resource==IntPtr.Zero)throw new InvalidDataException("Icon resource missing");var result=new byte[(int)SizeofResource(module,resource)];Marshal.Copy(LockResource(LoadResource(module,resource)),result,0,result.Length);return result;}
 public static void Apply(string exe,string icon){
  var ico=File.ReadAllBytes(icon);var images=Images(ico);var resources=new List<Resource>();
  var module=LoadLibraryEx(exe,IntPtr.Zero,0x22);if(module==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
  try{foreach(ushort type in new ushort[]{3,14}){EnumResourceNames(module,new IntPtr(type),delegate(IntPtr m,IntPtr t,IntPtr name,IntPtr p){var id=name.ToInt64();string text=(id>>16)==0?null:Marshal.PtrToStringUni(name);EnumResourceLanguages(m,t,name,delegate(IntPtr lm,IntPtr lt,IntPtr ln,ushort language,IntPtr lp){resources.Add(new Resource{Type=type,Id=text==null?(int)id:0,Name=text,Language=language});return true;},IntPtr.Zero);return true;},IntPtr.Zero);}}
  finally{FreeLibrary(module);}
  var update=BeginUpdateResource(exe,false);if(update==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());bool committed=false;
  try{
   foreach(var r in resources){IntPtr name=r.Name==null?new IntPtr(r.Id):Marshal.StringToHGlobalUni(r.Name);try{Put(update,r.Type,name,r.Language,null);}finally{if(r.Name!=null)Marshal.FreeHGlobal(name);}}
   for(int i=0;i<images.Length;i++)Put(update,3,new IntPtr(i+1),0,images[i]);
   Put(update,14,new IntPtr(1),0,Group(ico,images.Length));
   if(!EndUpdateResource(update,false))throw new Win32Exception(Marshal.GetLastWin32Error());committed=true;
  }finally{if(!committed)EndUpdateResource(update,true);}
  Verify(exe,icon);
 }
 public static void Verify(string exe,string icon){
  var ico=File.ReadAllBytes(icon);var images=Images(ico);var module=LoadLibraryEx(exe,IntPtr.Zero,0x22);if(module==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
  try{if(!Read(module,14,1).SequenceEqual(Group(ico,images.Length)))throw new InvalidDataException("Embedded icon directory differs");for(int i=0;i<images.Length;i++)if(!Read(module,3,(ushort)(i+1)).SequenceEqual(images[i]))throw new InvalidDataException("Embedded icon image differs");}
  finally{FreeLibrary(module);}
 }
}
'@
if ($VerifyOnly) { [DockIconResources]::Verify($targetExe,[IO.Path]::GetFullPath($IconPath)) }
else { [DockIconResources]::Apply($targetExe,[IO.Path]::GetFullPath($IconPath)) }
Write-Output 'Executable icon matches every frame of MusicPlayerDock-logo.ico.'
