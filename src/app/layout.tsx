import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lead Conversion System",
  description: "Production-ready MVP for real estate AI lead conversion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme-mode');if(!t){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  function isNoisyFetch(reason){
    var message = '';
    var stack = '';
    try {
      message = String((reason && reason.message) || reason || '').toLowerCase();
      stack = String((reason && reason.stack) || '').toLowerCase();
    } catch (_) {}

    var networkFail = message.indexOf('failed to fetch') !== -1 || message.indexOf('err_internet_disconnected') !== -1;
    var extensionNoise = stack.indexOf('chrome-extension://') !== -1 || stack.indexOf('frame_ant.js') !== -1 || message.indexOf('frame_ant.js') !== -1;
    var devtoolsNoise = stack.indexOf('next-devtools') !== -1 || message.indexOf('__nextjs_original-stack-frames') !== -1;

    return networkFail && (extensionNoise || devtoolsNoise || message.indexOf('err_internet_disconnected') !== -1);
  }

  window.addEventListener('unhandledrejection', function(e){
    if (isNoisyFetch(e.reason)) {
      e.preventDefault();
    }
  });

  window.addEventListener('error', function(e){
    if (isNoisyFetch(e.error || e.message)) {
      e.preventDefault();
    }
  }, true);
})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
