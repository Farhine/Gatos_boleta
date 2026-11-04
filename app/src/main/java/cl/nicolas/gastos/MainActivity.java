package cl.nicolas.gastos;
import android.app.Activity;import android.content.ClipData;import android.content.Intent;import android.net.Uri;import android.os.Bundle;import android.provider.MediaStore;import android.webkit.*;
import android.graphics.Bitmap;import android.graphics.BitmapFactory;import android.graphics.Rect;import android.util.Base64;
import com.google.mlkit.vision.common.InputImage;import com.google.mlkit.vision.text.Text;import com.google.mlkit.vision.text.TextRecognition;import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.json.JSONArray;import org.json.JSONException;import org.json.JSONObject;
import java.io.File;import java.io.FileOutputStream;import java.io.IOException;import java.io.InputStream;import java.nio.charset.StandardCharsets;
public class MainActivity extends Activity{
  private static final int PICK=1;private static final String BASE="https://boleta.local/";
  private WebView web;private ValueCallback<Uri[]> cb;private Uri photo;
  @Override protected void onCreate(Bundle b){
    super.onCreate(b);
    web=new WebView(this);setContentView(web);
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
    if(b!=null)web.restoreState(b);else web.loadUrl(BASE);
  }
  @Override protected void onActivityResult(int q,int r,Intent d){
    if(q!=PICK||cb==null)return;
    Uri[] out=null;
    if(r==RESULT_OK)out=photo!=null?new Uri[]{photo}:WebChromeClient.FileChooserParams.parseResult(r,d);
    cb.onReceiveValue(out);cb=null;
  }
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
  @JavascriptInterface public void shareFile(String name,String text){
    try{
      File f=new File(getCacheDir(),new File(name).getName());
      try(FileOutputStream o=new FileOutputStream(f)){o.write(text.getBytes(StandardCharsets.UTF_8));}
      Intent i=new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM,CacheProvider.uri(f)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(Intent.createChooser(i,"Guardar respaldo"));
    }catch(IOException ignored){}
  }
  @Override public void onBackPressed(){
    web.evaluateJavascript("appBack()",v->{if(!"true".equals(v))finish();});
  }
}
