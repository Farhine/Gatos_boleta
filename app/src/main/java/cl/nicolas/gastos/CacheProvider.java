package cl.nicolas.gastos;
import android.content.ContentProvider;import android.content.ContentValues;import android.database.Cursor;import android.database.MatrixCursor;import android.net.Uri;import android.os.ParcelFileDescriptor;import android.provider.OpenableColumns;
import java.io.File;import java.io.FileNotFoundException;
/** Expone archivos de la caché a la cámara y a "compartir", sin depender de androidx. */
public class CacheProvider extends ContentProvider{
  static final String AUTH="cl.nicolas.gastos.files";
  static Uri uri(File f){return Uri.parse("content://"+AUTH+"/"+Uri.encode(f.getName()));}
  private File file(Uri u){return new File(getContext().getCacheDir(),new File(u.getLastPathSegment()).getName());}
  @Override public boolean onCreate(){return true;}
  @Override public ParcelFileDescriptor openFile(Uri u,String mode) throws FileNotFoundException{
    return ParcelFileDescriptor.open(file(u),ParcelFileDescriptor.parseMode(mode.isEmpty()?"r":mode));}
  @Override public Cursor query(Uri u,String[] p,String s,String[] a,String o){
    File f=file(u);MatrixCursor c=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});c.addRow(new Object[]{f.getName(),f.length()});return c;}
  @Override public String getType(Uri u){String n=u.getLastPathSegment();return n.endsWith(".json")?"application/json":n.endsWith(".csv")?"text/csv":"image/jpeg";}
  @Override public Uri insert(Uri u,ContentValues v){return null;}
  @Override public int delete(Uri u,String s,String[] a){return 0;}
  @Override public int update(Uri u,ContentValues v,String s,String[] a){return 0;}
}
