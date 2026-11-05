package cl.nicolas.gastos;
import android.app.Activity;import android.content.ClipData;import android.content.Intent;import android.net.Uri;import android.os.Bundle;import android.provider.MediaStore;import android.webkit.*;
import android.graphics.Bitmap;import android.graphics.BitmapFactory;import android.graphics.Rect;import android.util.Base64;
import com.google.mlkit.vision.common.InputImage;import com.google.mlkit.vision.text.Text;import com.google.mlkit.vision.text.TextRecognition;import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.json.JSONArray;import org.json.JSONException;import org.json.JSONObject;
import android.Manifest;import android.content.pm.PackageManager;import android.hardware.biometrics.BiometricManager;import android.hardware.biometrics.BiometricPrompt;import android.os.Build;import android.os.CancellationSignal;import android.view.View;
import com.google.android.gms.location.LocationServices;import com.google.android.gms.location.Priority;
import java.io.File;import java.io.FileOutputStream;import java.io.IOException;import java.io.InputStream;import java.nio.charset.StandardCharsets;
public class MainActivity extends Activity{
  private static final int PICK=1,BK=2;private static final String BASE="https://boleta.local/";
  private WebView web;private ValueCallback<Uri[]> cb;private Uri photo;
  @Override protected void onCreate(Bundle b){
    super.onCreate(b);
    web=new WebView(this);
    boolean night=(getResources().getConfiguration().uiMode&android.content.res.Configuration.UI_MODE_NIGHT_MASK)==android.content.res.Configuration.UI_MODE_NIGHT_YES;
    web.setBackgroundColor(night?0xFF0F1413:0xFFF4F6F5);setContentView(web);
    WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);
    web.addJavascriptInterface(this,"Android");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
        Uri u=r.getUrl();
        if(!"boleta.local".equals(u.getHost()))return new WebResourceResponse("text/plain","utf-8",null);
        String p=u.getPath();if(p==null||p.equals("/"))p="/index.html";
        String m=p.endsWith(".js")?"text/javascript":"text/html";
        try{InputStream in=getAssets().open(p.substring(1));return new WebResourceResponse(m,"utf-8",in);}catch(IOException e){return null;}
      }});
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> c,FileChooserParams p){
        if(cb!=null)cb.onReceiveValue(null);cb=c;photo=null;
        Intent i;
        try{
          if(p.isCaptureEnabled()){
            File f=new File(getCacheDir(),"foto-"+System.currentTimeMillis()+".jpg");f.createNewFile();
            photo=CacheProvider.uri(f);
            i=new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT,photo);
            i.setClipData(ClipData.newRawUri("foto",photo));
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
          }else i=p.createIntent();
          startActivityForResult(i,PICK);return true;
        }catch(Exception e){cb=null;return false;}
      }});
    if(b!=null)web.restoreState(b);else web.loadUrl(BASE+(getIntent().getBooleanExtra("nuevo",false)?"?nuevo=1":""));
    Native.schedule(this);Native.geofences(this);
  }
  @Override protected void onActivityResult(int q,int r,Intent d){
    if(q==BK){
      if(r==RESULT_OK&&d!=null&&d.getData()!=null){
        Uri u=d.getData();
        try{getContentResolver().takePersistableUriPermission(u,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);}catch(RuntimeException ignored){}
        getSharedPreferences("b",MODE_PRIVATE).edit().putString("uri",u.toString()).apply();
        web.evaluateJavascript("onBackupPicked()",null);
      }
      return;
    }
    if(q!=PICK||cb==null)return;
    Uri[] out=null;
    if(r==RESULT_OK)out=photo!=null?new Uri[]{photo}:WebChromeClient.FileChooserParams.parseResult(r,d);
    cb.onReceiveValue(out);cb=null;
  }
  private boolean away=true;
  private boolean locked(){try{return new org.json.JSONObject(Native.prefs(this).getString("sync","{}")).optBoolean("lock");}catch(Exception e){return false;}}
  @Override protected void onStart(){
    super.onStart();
    if(!away||!locked()||Build.VERSION.SDK_INT<30){away=false;return;}
    web.setVisibility(View.INVISIBLE);
    new BiometricPrompt.Builder(this).setTitle("Boleta").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK|BiometricManager.Authenticators.DEVICE_CREDENTIAL).build()
      .authenticate(new CancellationSignal(),getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r){away=false;web.setVisibility(View.VISIBLE);}
        @Override public void onAuthenticationError(int c,CharSequence s){finish();}
      });
  }
  @Override protected void onStop(){super.onStop();if(cb==null)away=true;}
  @Override protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);web.saveState(b);}
  @JavascriptInterface public void readReceipt(String dataUrl){
    try{
      byte[] raw=Base64.decode(dataUrl.substring(dataUrl.indexOf(',')+1),Base64.DEFAULT);
      Bitmap bmp=BitmapFactory.decodeByteArray(raw,0,raw.length);
      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(InputImage.fromBitmap(bmp,0))
        .addOnSuccessListener(t->{
          JSONArray a=new JSONArray();
          try{
            for(Text.TextBlock b:t.getTextBlocks())for(Text.Line l:b.getLines()){
              Rect r=l.getBoundingBox();if(r==null)continue;
              a.put(new JSONObject().put("t",l.getText()).put("x",r.left).put("y",r.top).put("h",r.height()));
            }
            ocrDone(a.toString(),"false");
          }catch(JSONException e){ocrDone("[]","true");}
        })
        .addOnFailureListener(e->ocrDone("[]","true"));
    }catch(RuntimeException e){ocrDone("[]","true");}
  }
  private void ocrDone(String json,String err){runOnUiThread(()->web.evaluateJavascript("onOcr("+json+","+err+")",null));}
  @JavascriptInterface public boolean hasBackup(){return getSharedPreferences("b",MODE_PRIVATE).contains("uri");}
  @JavascriptInterface public void pickBackup(){
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"boleta-respaldo.json");
    i.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    startActivityForResult(i,BK);
  }
  @JavascriptInterface public boolean writeBackup(String t){
    String u=getSharedPreferences("b",MODE_PRIVATE).getString("uri",null);if(u==null)return false;
    try(java.io.OutputStream o=getContentResolver().openOutputStream(Uri.parse(u),"wt")){o.write(t.getBytes(StandardCharsets.UTF_8));return true;}catch(Exception e){return false;}
  }
  @JavascriptInterface public void openUrl(String u){startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(u)));}
  @JavascriptInterface public void sync(String json){
    String old=Native.prefs(this).getString("sync","{}");
    Native.prefs(this).edit().putString("sync",json).apply();BoletaWidget.refresh(this);
    if(!places(old).equals(places(json)))Native.geofences(this);
  }
  private String places(String s){try{return String.valueOf(new org.json.JSONObject(s).optJSONArray("places"));}catch(Exception e){return "";}}
  @JavascriptInterface public void shareText(String t){startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,t),"Compartir"));}
  @JavascriptInterface public void askNotifications(){if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},3);}
  private String pendingPlace;
  @JavascriptInterface public void addPlace(String name){
    runOnUiThread(()->{
      pendingPlace=name;
      if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},4);
      else locate();
    });
  }
  private void locate(){
    try{
      LocationServices.getFusedLocationProviderClient(this).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY,null)
        .addOnSuccessListener(l->{String n=org.json.JSONObject.quote(pendingPlace);web.evaluateJavascript(l==null?"onPlace(null)":"onPlace("+n+","+l.getLatitude()+","+l.getLongitude()+")",null);})
        .addOnFailureListener(e->web.evaluateJavascript("onPlace(null)",null));
    }catch(SecurityException e){web.evaluateJavascript("onPlace(null)",null);}
    if(checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED)web.evaluateJavascript("onNeedAlways()",null);
  }
  @JavascriptInterface public void askAlways(){runOnUiThread(()->requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},5));}
  @Override public void onRequestPermissionsResult(int q,String[] p,int[] r){
    if(q==4&&r.length>0&&r[0]==PackageManager.PERMISSION_GRANTED)locate();
    else if(q==4)web.evaluateJavascript("onPlace(null)",null);
    if(q==5)Native.geofences(this);
  }
  @JavascriptInterface public void shareFile(String name,String text){
    try{
      File f=new File(getCacheDir(),new File(name).getName());
      try(FileOutputStream o=new FileOutputStream(f)){o.write(text.getBytes(StandardCharsets.UTF_8));}
      Intent i=new Intent(Intent.ACTION_SEND).setType(name.endsWith(".csv")?"text/csv":"application/json").putExtra(Intent.EXTRA_STREAM,CacheProvider.uri(f)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(Intent.createChooser(i,"Guardar o compartir"));
    }catch(IOException ignored){}
  }
  @Override public void onBackPressed(){
    web.evaluateJavascript("appBack()",v->{if(!"true".equals(v))finish();});
  }
}
