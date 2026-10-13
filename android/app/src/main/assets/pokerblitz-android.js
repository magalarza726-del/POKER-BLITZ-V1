/* Solo se carga en el WebView del APK. Los archivos se guardan mediante el
   selector nativo de Android, sin permisos de almacenamiento ni Internet. */
(function () {
  'use strict';
  window.PokerBlitzAndroid = {
    saveBlob: function (blob, fileName) {
      if (!window.AndroidBridge) return false;
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        if (comma < 0) {
          console.error('No se pudo convertir el archivo para Android');
          return;
        }
        window.AndroidBridge.saveFile(
          String(fileName || 'poker_blitz.dat'),
          String(blob.type || 'application/octet-stream'),
          result.slice(comma + 1)
        );
      };
      reader.onerror = function () { console.error('No se pudo leer el archivo'); };
      reader.readAsDataURL(blob);
      return true;
    }
  };
})();
