import './globals.css';

export const metadata = {
  title: 'SEO Command Center',
  description: 'مركز قيادة SEO لكل مواقعك',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="max-w-6xl mx-auto p-6">
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">🎯 SEO Command Center</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:text-blue-400">الرئيسية</a>
              <a href="/sites" className="hover:text-blue-400">المواقع</a>
              <a href="/tasks" className="hover:text-blue-400">المهام</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
