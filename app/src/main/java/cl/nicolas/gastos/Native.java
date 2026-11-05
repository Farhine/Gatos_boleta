package cl.nicolas.gastos;
import android.app.*;import android.content.*;import android.os.Build;import android.content.pm.PackageManager;import android.Manifest;
import com.google.android.gms.location.*;
import org.json.*;
import java.util.*;
/** Notificaciones, alarmas y geocercas. */
final class Native{
  static SharedPreferences prefs(Context c){return c.getSharedPreferences("b",Context.MODE_PRIVATE);}
  static void notify(Context c,int id,String title,String text){
    NotificationManager m=c.getSystemService(NotificationManager.class);
    m.createNotificationChannel(new NotificationChannel("avisos","Avisos",NotificationManager.IMPORTANCE_DEFAULT));
    PendingIntent p=PendingIntent.getActivity(c,id,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE);
    m.notify(id,new Notification.Builder(c,"avisos").setSmallIcon(R.drawable.ic).setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(p).setAutoCancel(true).build());
  }
  static void schedule(Context c){
    PendingIntent p=PendingIntent.getBroadcast(c,1,new Intent(c,ReminderReceiver.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Calendar k=Calendar.getInstance();k.set(Calendar.HOUR_OF_DAY,10);k.set(Calendar.MINUTE,0);
    if(k.getTimeInMillis()<System.currentTimeMillis())k.add(Calendar.DAY_OF_YEAR,1);
    c.getSystemService(AlarmManager.class).setInexactRepeating(AlarmManager.RTC_WAKEUP,k.getTimeInMillis(),AlarmManager.INTERVAL_DAY,p);
  }
  static void geofences(Context c){
    if(c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;
    if(c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;
    PendingIntent p=PendingIntent.getBroadcast(c,2,new Intent(c,GeoReceiver.class),PendingIntent.FLAG_MUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    GeofencingClient g=LocationServices.getGeofencingClient(c);
    g.removeGeofences(p);
    try{
      JSONObject s=new JSONObject(prefs(c).getString("sync","{}"));JSONArray a=s.optJSONArray("places");
      if(a==null||a.length()==0)return;
      List<Geofence> l=new ArrayList<>();
      for(int i=0;i<a.length()&&i<90;i++){JSONObject o=a.getJSONObject(i);
        l.add(new Geofence.Builder().setRequestId(o.getString("name")).setCircularRegion(o.getDouble("lat"),o.getDouble("lng"),120f).setExpirationDuration(Geofence.NEVER_EXPIRE).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER).build());}
      g.addGeofences(new GeofencingRequest.Builder().setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER).addGeofences(l).build(),p);
    }catch(JSONException|SecurityException ignored){}
  }
}
