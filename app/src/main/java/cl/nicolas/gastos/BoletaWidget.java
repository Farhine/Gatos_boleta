package cl.nicolas.gastos;
import android.app.PendingIntent;import android.appwidget.*;import android.content.*;import android.widget.RemoteViews;
import org.json.JSONObject;
public class BoletaWidget extends AppWidgetProvider{
  @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){
    String t="$0";try{t=new JSONObject(Native.prefs(c).getString("sync","{}")).optString("month","$0");}catch(Exception ignored){}
    RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.widget);v.setTextViewText(R.id.total,t);
    v.setOnClickPendingIntent(R.id.root,PendingIntent.getActivity(c,3,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE));
    v.setOnClickPendingIntent(R.id.add,PendingIntent.getActivity(c,4,new Intent(c,MainActivity.class).putExtra("nuevo",true),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
    m.updateAppWidget(ids,v);
  }
  static void refresh(Context c){AppWidgetManager m=AppWidgetManager.getInstance(c);int[] ids=m.getAppWidgetIds(new ComponentName(c,BoletaWidget.class));if(ids.length>0)new BoletaWidget().onUpdate(c,m,ids);}
}
