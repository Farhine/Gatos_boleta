package cl.nicolas.gastos;
import android.content.*;
import com.google.android.gms.location.*;
import org.json.JSONObject;
public class GeoReceiver extends BroadcastReceiver{
  @Override public void onReceive(Context c,Intent i){
    GeofencingEvent e=GeofencingEvent.fromIntent(i);
    if(e==null||e.hasError()||e.getTriggeringGeofences()==null||e.getTriggeringGeofences().isEmpty())return;
    int n=0;try{n=new JSONObject(Native.prefs(c).getString("sync","{}")).optInt("listCount");}catch(Exception ignored){}
    if(n>0)Native.notify(c,10,"Estás en "+e.getTriggeringGeofences().get(0).getRequestId(),"Tienes "+n+" cosa"+(n==1?"":"s")+" en tu lista de compras");
  }
}
