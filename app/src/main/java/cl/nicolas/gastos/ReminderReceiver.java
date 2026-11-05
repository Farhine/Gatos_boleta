package cl.nicolas.gastos;
import android.content.*;
import org.json.*;
import java.util.Calendar;
public class ReminderReceiver extends BroadcastReceiver{
  @Override public void onReceive(Context c,Intent i){
    Native.schedule(c);
    if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())){Native.geofences(c);return;}
    try{
      JSONObject s=new JSONObject(Native.prefs(c).getString("sync","{}"));
      if(!s.optBoolean("remind",true))return;
      Calendar k=Calendar.getInstance();k.add(Calendar.DAY_OF_YEAR,1);int d=k.get(Calendar.DAY_OF_MONTH);
      JSONArray f=s.optJSONArray("fixed");
      if(f!=null)for(int n=0;n<f.length();n++){JSONObject o=f.getJSONObject(n);if(o.getInt("day")==d)Native.notify(c,100+n,"Gasto fijo mañana",o.getString("title"));}
      String debt=s.optString("debts","");
      if(!debt.isEmpty()&&Calendar.getInstance().get(Calendar.DAY_OF_WEEK)==Calendar.MONDAY)Native.notify(c,20,"Deudas pendientes",debt);
    }catch(JSONException ignored){}
  }
}
