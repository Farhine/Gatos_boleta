package cl.nicolas.gastos;
import android.app.Notification;import android.content.SharedPreferences;import android.os.Bundle;import android.service.notification.NotificationListenerService;import android.service.notification.StatusBarNotification;
import org.json.*;
import java.util.*;
/** Guarda localmente solo avisos con monto de las apps financieras indicadas. */
public class BankListener extends NotificationListenerService{
  private static final Map<String,String> APPS=new HashMap<>();
  static{APPS.put("cl.bancochile.mi_banco","Banco de Chile");APPS.put("cl.bancochile.mi_pago","Banco de Chile");APPS.put("com.mercadopago.wallet","Mercado Pago");APPS.put("com.mercadolibre","Mercado Libre");}
  @Override public void onNotificationPosted(StatusBarNotification n){
    String app=APPS.get(n.getPackageName());if(app==null)return;
    Notification o=n.getNotification();if(o==null||(o.flags&Notification.FLAG_GROUP_SUMMARY)!=0)return;
    Bundle e=o.extras;CharSequence t=e.getCharSequence(Notification.EXTRA_TITLE),b=e.getCharSequence(Notification.EXTRA_BIG_TEXT);
    if(b==null)b=e.getCharSequence(Notification.EXTRA_TEXT);
    String text=((t==null?"":t+" ")+(b==null?"":b)).trim();
    if(!text.matches("(?s).*\\$\\s?\\d.*"))return;
    synchronized(BankListener.class){
      try{
        SharedPreferences p=Native.prefs(this);JSONArray a=new JSONArray(p.getString("inbox","[]"));
        for(int i=0;i<a.length();i++)if(text.equals(a.getJSONObject(i).getString("text")))return;
        a.put(new JSONObject().put("app",app).put("text",text).put("when",n.getPostTime()));
        p.edit().putString("inbox",a.toString()).apply();
      }catch(JSONException ignored){}
    }
  }
}
