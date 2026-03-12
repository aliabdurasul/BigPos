import { createRoot } from "react-dom/client";
import { supabaseConfigured } from "@/lib/supabase";
import App from "./App.tsx";
import "./index.css";

// #region agent log
window.onerror = function(msg, src, line, col, err) {
  console.error('[DEBUG-b1a753] GLOBAL ERROR:', msg, 'at', src, line, col, err?.stack);
  const d = document.getElementById('debug-b1a753-err');
  if (d) d.textContent = `ERROR: ${msg}\nSource: ${src}:${line}:${col}\nStack: ${err?.stack || 'none'}`;
  else {
    const el = document.createElement('pre');
    el.id = 'debug-b1a753-err';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:red;color:white;padding:16px;font-size:12px;white-space:pre-wrap;max-height:50vh;overflow:auto';
    el.textContent = `ERROR: ${msg}\nSource: ${src}:${line}:${col}\nStack: ${err?.stack || 'none'}`;
    document.body.appendChild(el);
  }
  fetch('http://127.0.0.1:7445/ingest/b8d5d89b-c3cc-4877-b1ec-68f838950bb8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b1a753'},body:JSON.stringify({sessionId:'b1a753',location:'main.tsx:onerror',message:'Global error caught',data:{msg:String(msg),src,line,col,stack:err?.stack},timestamp:Date.now(),hypothesisId:'GLOBAL'})}).catch(()=>{});
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[DEBUG-b1a753] UNHANDLED REJECTION:', e.reason);
});
console.log('[DEBUG-b1a753] main.tsx loaded, supabaseConfigured:', supabaseConfigured);
// #endregion

const root = createRoot(document.getElementById("root")!);

if (!supabaseConfigured) {
  root.render(
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        background: "#f5f3f0",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "#fef2f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 28,
          }}
        >
          ⚠
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#1a1a1a" }}>
          Yapılandırma Hatası
        </h1>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px", lineHeight: 1.6 }}>
          <code
            style={{
              background: "#f5f3f0",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            VITE_SUPABASE_URL
          </code>{" "}
          veya{" "}
          <code
            style={{
              background: "#f5f3f0",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            VITE_SUPABASE_ANON_KEY
          </code>{" "}
          ortam değişkenleri bulunamadı.
        </p>
        <div
          style={{
            background: "#fafaf8",
            border: "1px solid #e5e2dc",
            borderRadius: 12,
            padding: 16,
            textAlign: "left",
            fontSize: 13,
            lineHeight: 1.8,
            color: "#333",
          }}
        >
          <strong>Çözüm:</strong>
          <br />
          1. Proje kök dizininde{" "}
          <code style={{ background: "#f0ede8", padding: "1px 4px", borderRadius: 3 }}>
            .env
          </code>{" "}
          dosyası oluşturun
          <br />
          2.{" "}
          <code style={{ background: "#f0ede8", padding: "1px 4px", borderRadius: 3 }}>
            .env.example
          </code>{" "}
          dosyasını şablon olarak kullanın
          <br />
          3. Geliştirme sunucusunu yeniden başlatın
        </div>
      </div>
    </div>
  );
} else {
  root.render(<App />);
}
