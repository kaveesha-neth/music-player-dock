using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

// Cropped live desktop pixels only. No recordings, files or network operations.
// The owner HWND must already be excluded by Electron, in its owning process.
static class DesktopGlass {
 const int HeaderSize=56;const uint Exclude=0x11;
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)]struct MonitorInfo{public int Size;public Rect Monitor,Work;public uint Flags;}
 [StructLayout(LayoutKind.Sequential)]struct BitmapInfo{public uint Size;public int Width,Height;public ushort Planes,BitCount;public uint Compression,ImageSize;public int Xppm,Yppm;public uint Used,Important;}
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr GetDC(IntPtr hwnd);
 [DllImport("user32.dll")]static extern int ReleaseDC(IntPtr hwnd,IntPtr dc);
 [DllImport("user32.dll",SetLastError=true)]static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
 [DllImport("user32.dll",SetLastError=true)]static extern bool GetWindowDisplayAffinity(IntPtr hwnd,out uint affinity);
 [DllImport("user32.dll",SetLastError=true)]static extern bool SetWindowDisplayAffinity(IntPtr hwnd,uint affinity);
 [DllImport("user32.dll")]static extern IntPtr MonitorFromWindow(IntPtr hwnd,uint flags);
 [DllImport("user32.dll")]static extern bool GetMonitorInfo(IntPtr monitor,ref MonitorInfo info);
 [DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("gdi32.dll",SetLastError=true)]static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32.dll",SetLastError=true)]static extern IntPtr CreateDIBSection(IntPtr dc,ref BitmapInfo info,uint usage,out IntPtr bits,IntPtr section,uint offset);
 [DllImport("gdi32.dll")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32.dll")]static extern bool DeleteDC(IntPtr dc);
 [DllImport("gdi32.dll")]static extern int SetStretchBltMode(IntPtr dc,int mode);
 [DllImport("gdi32.dll")]static extern bool SetBrushOrgEx(IntPtr dc,int x,int y,IntPtr previous);
 [DllImport("gdi32.dll",SetLastError=true)]static extern bool StretchBlt(IntPtr target,int x,int y,int width,int height,IntPtr source,int sx,int sy,int sw,int sh,uint operation);
 [DllImport("dwmapi.dll")]static extern int DwmFlush();
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateWindowEx(uint ex,string name,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
 [DllImport("user32.dll")]static extern bool DestroyWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern bool SetLayeredWindowAttributes(IntPtr hwnd,uint color,byte alpha,uint flags);
 [DllImport("user32.dll")]static extern bool UpdateWindow(IntPtr hwnd);
 [DllImport("user32.dll")]static extern int FillRect(IntPtr dc,ref Rect rect,IntPtr brush);
 [DllImport("gdi32.dll")]static extern IntPtr CreateSolidBrush(uint color);
 [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int width,int height,uint flags);

 sealed class BufferSurface:IDisposable {
  public int Width,Height;public byte[] Pixels=[];IntPtr screen,dc,bitmap,previous,bits;
  public void Resize(int w,int h){
   if(w==Width&&h==Height&&bitmap!=IntPtr.Zero)return;Dispose();Width=w;Height=h;
   screen=GetDC(IntPtr.Zero);if(screen==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
   dc=CreateCompatibleDC(screen);if(dc==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
   var info=new BitmapInfo{Size=(uint)Marshal.SizeOf<BitmapInfo>(),Width=w,Height=-h,Planes=1,BitCount=32,ImageSize=(uint)(w*h*4)};
   bitmap=CreateDIBSection(screen,ref info,0,out bits,IntPtr.Zero,0);if(bitmap==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
   previous=SelectObject(dc,bitmap);SetStretchBltMode(dc,4);SetBrushOrgEx(dc,0,0,IntPtr.Zero);Pixels=new byte[w*h*4];
  }
  public byte[] Capture(Rect r,int w,int h){
   Resize(w,h);
   if(!StretchBlt(dc,0,0,w,h,screen,r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top,0x40CC0020))throw new Win32Exception(Marshal.GetLastWin32Error());
   Marshal.Copy(bits,Pixels,0,Pixels.Length);
   for(int i=0;i<Pixels.Length;i+=4){(Pixels[i],Pixels[i+2])=(Pixels[i+2],Pixels[i]);Pixels[i+3]=255;}
   return Pixels;
  }
  public void Dispose(){if(dc!=IntPtr.Zero&&previous!=IntPtr.Zero)SelectObject(dc,previous);if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(dc!=IntPtr.Zero)DeleteDC(dc);if(screen!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,screen);screen=dc=bitmap=previous=bits=IntPtr.Zero;Width=Height=0;}
 }
 record Request(int Id,string Hwnd,int Margin=96,int MaxWidth=1024,int MaxHeight=768);
 static void Packet(Stream output,int status,int id,int width,int height,byte[] payload,Rect window,Rect capture,bool excluded){
  var header=new byte[HeaderSize];Encoding.ASCII.GetBytes("MPDG").CopyTo(header,0);
  int[] values=[status,id,width,height,payload.Length,window.Left-capture.Left,window.Top-capture.Top,window.Right-window.Left,window.Bottom-window.Top,capture.Right-capture.Left,capture.Bottom-capture.Top,excluded?1:0,0];
  for(int i=0;i<values.Length;i++)BitConverter.GetBytes(values[i]).CopyTo(header,4+i*4);
  output.Write(header);output.Write(payload);output.Flush();
 }
 static ulong Hash(byte[] bytes){ulong hash=14695981039346656037;for(int i=0;i<bytes.Length;i+=4){hash=(hash^BitConverter.ToUInt32(bytes,i))*1099511628211;}return hash;}
 public static async Task Run(){
  using var surface=new BufferSurface();using var stdout=Console.OpenStandardOutput();ulong previousHash=0;string previousGeometry="";string? line;
  while((line=await Console.In.ReadLineAsync())!=null){
   Request? request=null;var old=SetThreadDpiAwarenessContext(new IntPtr(-4));
   try{
    request=JsonSerializer.Deserialize<Request>(line,new JsonSerializerOptions{PropertyNameCaseInsensitive=true})??throw new InvalidDataException("Invalid capture request");
    var hwnd=new IntPtr(long.Parse(request.Hwnd));
    bool hasAffinity=GetWindowDisplayAffinity(hwnd,out uint affinity);int affinityError=Marshal.GetLastWin32Error();
    if(!hasAffinity||affinity!=Exclude)throw new InvalidOperationException($"Desktop capture stopped: the dock is not excluded from capture. {(hasAffinity?$"Reported affinity 0x{affinity:X}":$"Affinity query failed (Win32 {affinityError})")}");
    if(!GetWindowRect(hwnd,out var window))throw new Win32Exception(Marshal.GetLastWin32Error());
    int ww=window.Right-window.Left,wh=window.Bottom-window.Top;
    if(ww<=0||wh<=0||ww>4096||wh>2160)throw new InvalidDataException("Invalid dock bounds");
    var monitor=new MonitorInfo{Size=Marshal.SizeOf<MonitorInfo>()};if(!GetMonitorInfo(MonitorFromWindow(hwnd,2),ref monitor))throw new InvalidOperationException("Display unavailable");
    int margin=Math.Clamp(request.Margin,16,256);
    var capture=new Rect{Left=Math.Max(monitor.Monitor.Left,window.Left-margin),Top=Math.Max(monitor.Monitor.Top,window.Top-margin),Right=Math.Min(monitor.Monitor.Right,window.Right+margin),Bottom=Math.Min(monitor.Monitor.Bottom,window.Bottom+margin)};
    int sw=capture.Right-capture.Left,sh=capture.Bottom-capture.Top;if(sw<=0||sh<=0)throw new InvalidDataException("Capture area outside display");
    double ratio=Math.Min(1,Math.Min(Math.Clamp(request.MaxWidth,256,1280)/(double)sw,Math.Clamp(request.MaxHeight,192,960)/(double)sh));
    int width=Math.Max(1,(int)Math.Round(sw*ratio)),height=Math.Max(1,(int)Math.Round(sh*ratio));
    byte[] pixels=surface.Capture(capture,width,height);ulong hash=Hash(pixels);
    string geometry=$"{window.Left},{window.Top},{ww},{wh},{capture.Left},{capture.Top},{sw},{sh},{width},{height}";
    bool same=hash==previousHash&&geometry==previousGeometry;previousHash=hash;previousGeometry=geometry;
    Packet(stdout,same?2:0,request.Id,width,height,same?[]:pixels,window,capture,true);
   }catch(Exception e){Packet(stdout,1,request?.Id??0,0,0,Encoding.UTF8.GetBytes(e.Message),default,default,false);}
   finally{SetThreadDpiAwarenessContext(old);}
  }
 }
 static void Paint(IntPtr hwnd,uint rgb){var dc=GetDC(hwnd);var brush=CreateSolidBrush(rgb);try{var r=new Rect{Right=64,Bottom=48};FillRect(dc,ref r,brush);}finally{DeleteObject(brush);ReleaseDC(hwnd,dc);}DwmFlush();Thread.Sleep(40);}
 public static void PixelProbe(){
  var old=SetThreadDpiAwarenessContext(new IntPtr(-4));
  try{var monitor=new MonitorInfo{Size=Marshal.SizeOf<MonitorInfo>()};if(!GetMonitorInfo(MonitorFromWindow(IntPtr.Zero,1),ref monitor))throw new InvalidOperationException("Display unavailable");
   var rect=new Rect{Left=monitor.Work.Left+24,Top=monitor.Work.Top+24,Right=monitor.Work.Left+40,Bottom=monitor.Work.Top+40};using var surface=new BufferSurface();var pixels=surface.Capture(rect,16,16);
   Console.WriteLine(JsonSerializer.Serialize(new{success=true,method="cropped-gdi",bytes=pixels.Length,digest=Hash(pixels).ToString("X16"),exclusionVerified=false}));
  }catch(Exception e){Console.WriteLine(JsonSerializer.Serialize(new{success=false,error=e.Message}));Environment.ExitCode=1;}
  finally{SetThreadDpiAwarenessContext(old);}
 }
 public static void Probe(){
  var old=SetThreadDpiAwarenessContext(new IntPtr(-4));IntPtr underlay=IntPtr.Zero,overlay=IntPtr.Zero;string stage="initializing";
  try{
   var monitor=new MonitorInfo{Size=Marshal.SizeOf<MonitorInfo>()};GetMonitorInfo(MonitorFromWindow(IntPtr.Zero,1),ref monitor);
   int x=monitor.Work.Left+24,y=monitor.Work.Top+64;uint ex=0x08080088,style=0x90000000;
   stage="creating probe window";underlay=CreateWindowEx(ex,"STATIC","Glass capture test",style,x,y,64,48,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
   if(underlay==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());SetLayeredWindowAttributes(underlay,0,255,2);UpdateWindow(underlay);Paint(underlay,0x00A0B40E);
   overlay=CreateWindowEx(ex,"STATIC","Excluded glass capture test",style,x,y,64,48,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
   if(overlay==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());SetLayeredWindowAttributes(overlay,0,255,2);UpdateWindow(overlay);Paint(overlay,0x00B420DC);
   var rect=new Rect{Left=x,Top=y,Right=x+64,Bottom=y+48};using var surface=new BufferSurface();
   var included=surface.Capture(rect,64,48);int offset=(24*64+32)*4;int[] top=[included[offset],included[offset+1],included[offset+2]];
   bool enabled=SetWindowDisplayAffinity(overlay,Exclude);GetWindowDisplayAffinity(overlay,out var affinity);DwmFlush();Thread.Sleep(60);
   var excluded=surface.Capture(rect,64,48);int[] behind=[excluded[offset],excluded[offset+1],excluded[offset+2]];
   bool success=enabled&&affinity==Exclude&&top.SequenceEqual(new[]{220,32,180})&&behind.SequenceEqual(new[]{14,180,160});
   Console.WriteLine(JsonSerializer.Serialize(new{success,enabled,affinity,top,behind,method="cropped-gdi",error=success?null:"Capture exclusion did not reveal the known background"}));if(!success)Environment.ExitCode=1;
  }catch(Exception e){Console.WriteLine(JsonSerializer.Serialize(new{success=false,stage,error=e.Message}));Environment.ExitCode=1;}
  finally{if(overlay!=IntPtr.Zero)DestroyWindow(overlay);if(underlay!=IntPtr.Zero)DestroyWindow(underlay);SetThreadDpiAwarenessContext(old);}
 }
}
