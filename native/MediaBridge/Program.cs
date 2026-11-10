using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Channels;
using Windows.Media;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Session = Windows.Media.Control.GlobalSystemMediaTransportControlsSession;

// A single serialized event pump keeps WinRT events, metadata reads and commands ordered.
class Program {
 static readonly JsonSerializerOptions Json = new(){PropertyNamingPolicy=JsonNamingPolicy.CamelCase};
 static readonly Channel<Func<Task>> Queue=Channel.CreateUnbounded<Func<Task>>(new(){SingleReader=true});
 static GlobalSystemMediaTransportControlsSessionManager? manager;
 static readonly Dictionary<Session,Entry> entries=new();
 static readonly Dictionary<string,Entry> ids=new();
 static bool refreshQueued;static string lastSnapshot="";
 static readonly object gate=new();
 static void Schedule(){lock(gate){if(refreshQueued)return;refreshQueued=true;}Queue.Writer.TryWrite(async()=>{lock(gate)refreshQueued=false;await Refresh();});}
 static async Task Main(){
  try {
   manager=await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
   manager.SessionsChanged+=(_,_)=>Schedule(); manager.CurrentSessionChanged+=(_,_)=>Schedule();
   Schedule();
   var input=Task.Run(async()=>{string? line;while((line=await Console.In.ReadLineAsync())!=null){try{var c=JsonSerializer.Deserialize<Command>(line,Json);if(c!=null)Queue.Writer.TryWrite(()=>Execute(c));}catch(Exception e){Console.Error.WriteLine(e.Message);}}Queue.Writer.TryComplete();});
   // Slow reconciliation also detects fullscreen changes and players missing timeline events.
   using var timer=new Timer(_=>Schedule(),null,1000,1000);
   await foreach(var work in Queue.Reader.ReadAllAsync())try{await work();}catch(Exception e){Console.Error.WriteLine(e.Message);}
   await input;
  } catch(Exception e){Console.Error.WriteLine(e.ToString());Environment.ExitCode=1;}
  finally {foreach(var entry in entries.Values)entry.Dispose();}
 }
 sealed class Entry:IDisposable {
  public Session Session; public string Id=Guid.NewGuid().ToString("N"); public bool Dirty=true;
  public string Title="",Artist="",Album="";public string? Artwork;
  public Entry(Session s){Session=s;s.MediaPropertiesChanged+=Metadata;s.PlaybackInfoChanged+=Playback;s.TimelinePropertiesChanged+=Timeline;}
  void Metadata(Session s,MediaPropertiesChangedEventArgs a){Dirty=true;Schedule();}
  void Playback(Session s,PlaybackInfoChangedEventArgs a)=>Schedule();
  void Timeline(Session s,TimelinePropertiesChangedEventArgs a)=>Schedule();
  public void Dispose(){Session.MediaPropertiesChanged-=Metadata;Session.PlaybackInfoChanged-=Playback;Session.TimelinePropertiesChanged-=Timeline;}
  public async Task Read(){
   if(!Dirty)return;Dirty=false;
   var p=await Session.TryGetMediaPropertiesAsync();Title=p.Title;Artist=p.Artist;Album=p.AlbumTitle;Artwork=null;
   if(p.Thumbnail!=null)try{using var stream=await p.Thumbnail.OpenReadAsync();if(stream.Size>0&&stream.Size<=6*1024*1024){using var reader=new DataReader(stream.GetInputStreamAt(0));await reader.LoadAsync((uint)stream.Size);var bytes=new byte[(int)stream.Size];reader.ReadBytes(bytes);var mime=stream.ContentType;if(mime is "image/jpeg" or "image/png" or "image/webp" or "image/bmp")Artwork=$"data:{mime};base64,{Convert.ToBase64String(bytes)}";}}catch{Artwork=null;}
  }
 }
 static async Task Refresh(){
  if(manager==null)return;
  var sessions=manager.GetSessions().ToArray();
  foreach(var s in entries.Keys.Except(sessions).ToArray()){ids.Remove(entries[s].Id);entries[s].Dispose();entries.Remove(s);}
  foreach(var s in sessions)if(!entries.ContainsKey(s)){var e=new Entry(s);entries.Add(s,e);ids.Add(e.Id,e);}
  var output=new List<object>();string? current=null;var system=manager.GetCurrentSession();
  foreach(var e in entries.Values)try{
   await e.Read();var p=e.Session.GetPlaybackInfo();var t=e.Session.GetTimelineProperties();var c=p.Controls;
   if(e.Session==system||e.Session.SourceAppUserModelId==system?.SourceAppUserModelId)current=e.Id;
   output.Add(new{id=e.Id,source=e.Session.SourceAppUserModelId,title=e.Title,artist=e.Artist,album=e.Album,artwork=e.Artwork,playing=p.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,position=Math.Max(0,(t.Position-t.StartTime).TotalSeconds),duration=Math.Max(0,(t.EndTime-t.StartTime).TotalSeconds),rate=p.PlaybackRate??1,updatedAt=t.LastUpdatedTime.ToUnixTimeMilliseconds(),shuffle=p.IsShuffleActive,repeat=p.AutoRepeatMode?.ToString(),controls=new{play=c.IsPlayEnabled,pause=c.IsPauseEnabled,toggle=c.IsPlayPauseToggleEnabled,next=c.IsNextEnabled,previous=c.IsPreviousEnabled,seek=c.IsPlaybackPositionEnabled,shuffle=c.IsShuffleEnabled,repeat=c.IsRepeatEnabled}});
  }catch(Exception ex){e.Dirty=true;Console.Error.WriteLine(ex.Message);}
  var json=JsonSerializer.Serialize(new{sessions=output,currentId=current,fullscreen=Native.Fullscreen()},Json);if(json!=lastSnapshot){lastSnapshot=json;Console.WriteLine(json);}
 }
 record Command(string Action,string Id,JsonElement Value);
 static async Task Execute(Command cmd){
  if(!ids.TryGetValue(cmd.Id,out var e))return;
  var s=e.Session;var c=s.GetPlaybackInfo().Controls;bool ok=false;
  switch(cmd.Action){
   case "play" when c.IsPlayEnabled:ok=await s.TryPlayAsync();break;
   case "pause" when c.IsPauseEnabled:ok=await s.TryPauseAsync();break;
   case "toggle":if(c.IsPlayPauseToggleEnabled)ok=await s.TryTogglePlayPauseAsync();else if(s.GetPlaybackInfo().PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing&&c.IsPauseEnabled)ok=await s.TryPauseAsync();else if(c.IsPlayEnabled)ok=await s.TryPlayAsync();break;
   case "next" when c.IsNextEnabled:ok=await s.TrySkipNextAsync();break;
   case "previous" when c.IsPreviousEnabled:ok=await s.TrySkipPreviousAsync();break;
   case "seek" when c.IsPlaybackPositionEnabled:var seconds=cmd.Value.GetDouble();var timeline=s.GetTimelineProperties();if(double.IsFinite(seconds))ok=await s.TryChangePlaybackPositionAsync((timeline.StartTime+TimeSpan.FromSeconds(Math.Clamp(seconds,0,Math.Max(0,(timeline.EndTime-timeline.StartTime).TotalSeconds)))).Ticks);break;
   case "shuffle" when c.IsShuffleEnabled:ok=await s.TryChangeShuffleActiveAsync(cmd.Value.GetBoolean());break;
   case "repeat" when c.IsRepeatEnabled:if(Enum.TryParse<MediaPlaybackAutoRepeatMode>(cmd.Value.GetString(),out var mode))ok=await s.TryChangeAutoRepeatModeAsync(mode);break;
   case "open":ok=Native.OpenSource(s.SourceAppUserModelId);break;
  }
  if(!ok)Console.Error.WriteLine($"Player declined {cmd.Action}");Schedule();
 }
}

static class Native {
 [StructLayout(LayoutKind.Sequential)] struct RECT{public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] struct MONITORINFO{public int Size;public RECT Monitor,Work;public uint Flags;}
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out RECT rect);
 [DllImport("user32.dll")]static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll")]static extern bool GetMonitorInfo(IntPtr h,ref MONITORINFO info);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr h,int command);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumWindow callback,IntPtr data);
 delegate bool EnumWindow(IntPtr h,IntPtr data);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("dwmapi.dll")]static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out RECT value,int size);
 [DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public static object? Fullscreen(){
  var prior=SetThreadDpiAwarenessContext(new IntPtr(-4));
  try{var h=GetForegroundWindow();if(h==IntPtr.Zero||IsIconic(h))return null;
   GetWindowThreadProcessId(h,out var pid);try{var name=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;if(name is "explorer" or "MusicPlayerDock" or "electron")return null;}catch{return null;}
   var m=new MONITORINFO{Size=Marshal.SizeOf<MONITORINFO>()};if(!GetMonitorInfo(MonitorFromWindow(h,2),ref m))return null;
   if(DwmGetWindowAttribute(h,9,out var r,Marshal.SizeOf<RECT>())!=0&&!GetWindowRect(h,out r))return null;
   if(r.Left<=m.Monitor.Left&&r.Top<=m.Monitor.Top&&r.Right>=m.Monitor.Right&&r.Bottom>=m.Monitor.Bottom){
    // Return physical bounds and scale to Electron DIP using monitor DPI.
    return new{x=m.Monitor.Left,y=m.Monitor.Top,width=m.Monitor.Right-m.Monitor.Left,height=m.Monitor.Bottom-m.Monitor.Top};
   }return null;
  }finally{SetThreadDpiAwarenessContext(prior);}
 }
 [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr h);
 public static bool OpenSource(string source){
  // Only activate an existing window; never treat untrusted source metadata as a URL or executable.
  string processName=source.EndsWith(".exe",StringComparison.OrdinalIgnoreCase)?Path.GetFileNameWithoutExtension(source):"";
  if(string.IsNullOrEmpty(processName))return false;
  bool found=false;EnumWindows((h,_)=>{if(!IsWindowVisible(h))return true;GetWindowThreadProcessId(h,out var id);try{using var p=System.Diagnostics.Process.GetProcessById((int)id);if(string.Equals(p.ProcessName,processName,StringComparison.OrdinalIgnoreCase)){ShowWindow(h,9);found=SetForegroundWindow(h);return false;}}catch{}return true;},IntPtr.Zero);return found;
 }
}
