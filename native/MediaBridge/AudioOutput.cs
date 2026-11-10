using System.Runtime.InteropServices;

public record AudioOutput(string Id,string Name,string Kind);

// Core Audio endpoint metadata, independent of GSMTC and per-app playback metadata.
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]
public sealed class AudioOutputWatcher:IAudioNotification,IDisposable {
 IAudioEnumerator? enumerator; readonly Action changed;int dirty=1;volatile bool disposed;
 DateTime nextRead=DateTime.MinValue;
 AudioOutput cached=new("","Windows output unavailable","unknown");
 static readonly PropertyKey FriendlyName=new(new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),14);
 static readonly PropertyKey FormFactor=new(new Guid("1da5d803-d492-4edd-8c23-e0c0ffee7f0e"),0);
 public AudioOutputWatcher(Action callback){changed=callback;Connect();}
 void Connect(){
  if(disposed||enumerator!=null)return;
  try{enumerator=(IAudioEnumerator)new AudioEnumeratorCom();Marshal.ThrowExceptionForHR(enumerator.RegisterEndpointNotificationCallback(this));}
  catch{if(enumerator!=null)Marshal.ReleaseComObject(enumerator);enumerator=null;}
 }
 public AudioOutput Read(){
  if(Interlocked.Exchange(ref dirty,0)==0&&DateTime.UtcNow<nextRead)return cached;
  nextRead=DateTime.UtcNow.AddSeconds(10);Connect();
  IAudioDevice? device=null;IAudioProperties? properties=null;IntPtr id=IntPtr.Zero;
  try{
   if(enumerator==null)return cached=new("","Windows output unavailable","unknown");
   int result=enumerator.GetDefaultAudioEndpoint(0,1,out device); // render / multimedia
   if(result<0||device==null)return cached=unchecked((uint)result)==0x80070490?new("","No audio output connected","none"):new("","Windows output unavailable","unknown");
   Marshal.ThrowExceptionForHR(device.GetId(out id));Marshal.ThrowExceptionForHR(device.OpenPropertyStore(0,out properties));
   string name=ReadString(properties,FriendlyName)??"Windows audio output";
   uint? factor=ReadNumber(properties,FormFactor);
   string kind=factor switch{3 or 5=>"headphones",1=>"speakers",9=>"display",_=>"unknown"};
   return cached=new(Marshal.PtrToStringUni(id)??"",name,kind);
  }catch{return cached=new("","Windows output unavailable","unknown");}
  finally{if(id!=IntPtr.Zero)Marshal.FreeCoTaskMem(id);if(properties!=null)Marshal.ReleaseComObject(properties);if(device!=null)Marshal.ReleaseComObject(device);}
 }
 static string? ReadString(IAudioProperties store,PropertyKey key){PropVariant value=default;try{Marshal.ThrowExceptionForHR(store.GetValue(ref key,out value));return value.Type==31?Marshal.PtrToStringUni(value.Pointer):null;}finally{PropVariantClear(ref value);}}
 static uint? ReadNumber(IAudioProperties store,PropertyKey key){PropVariant value=default;try{Marshal.ThrowExceptionForHR(store.GetValue(ref key,out value));return value.Type==19?value.Number:null;}finally{PropVariantClear(ref value);}}
 [DllImport("ole32.dll")]static extern int PropVariantClear(ref PropVariant value);
 void MarkChanged(){Interlocked.Exchange(ref dirty,1);if(!disposed)ThreadPool.QueueUserWorkItem(_=>{if(!disposed)changed();});}
 public int OnDeviceStateChanged(string id,uint state){MarkChanged();return 0;}
 public int OnDeviceAdded(string id){MarkChanged();return 0;}
 public int OnDeviceRemoved(string id){MarkChanged();return 0;}
 public int OnDefaultDeviceChanged(int flow,int role,string? id){if(flow==0&&role==1)MarkChanged();return 0;}
 public int OnPropertyValueChanged(string id,PropertyKey key){MarkChanged();return 0;}
 public void Dispose(){disposed=true;if(enumerator!=null){try{enumerator.UnregisterEndpointNotificationCallback(this);}catch{}Marshal.ReleaseComObject(enumerator);enumerator=null;}}
}

[StructLayout(LayoutKind.Sequential)]public struct PropertyKey{public Guid Format;public uint Id;public PropertyKey(Guid format,uint id){Format=format;Id=id;}}
[StructLayout(LayoutKind.Explicit,Size=24)]public struct PropVariant{[FieldOffset(0)]public ushort Type;[FieldOffset(8)]public IntPtr Pointer;[FieldOffset(8)]public uint Number;}
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"),ClassInterface(ClassInterfaceType.None)]class AudioEnumeratorCom{}
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioEnumerator {
 [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IntPtr devices);
 [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IAudioDevice device);
 [PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IAudioDevice device);
 [PreserveSig]int RegisterEndpointNotificationCallback(IAudioNotification client);
 [PreserveSig]int UnregisterEndpointNotificationCallback(IAudioNotification client);
}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioDevice {
 [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object instance);
 [PreserveSig]int OpenPropertyStore(uint mode,out IAudioProperties properties);
 [PreserveSig]int GetId(out IntPtr id);
 [PreserveSig]int GetState(out uint state);
}
[ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioProperties {
 [PreserveSig]int GetCount(out uint count);
 [PreserveSig]int GetAt(uint index,out PropertyKey key);
 [PreserveSig]int GetValue(ref PropertyKey key,out PropVariant value);
 [PreserveSig]int SetValue(ref PropertyKey key,ref PropVariant value);
 [PreserveSig]int Commit();
}
[ComVisible(true),Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface IAudioNotification {
 [PreserveSig]int OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)]string id,uint state);
 [PreserveSig]int OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)]string id);
 [PreserveSig]int OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)]string id);
 [PreserveSig]int OnDefaultDeviceChanged(int flow,int role,[MarshalAs(UnmanagedType.LPWStr)]string? id);
 [PreserveSig]int OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)]string id,PropertyKey key);
}
