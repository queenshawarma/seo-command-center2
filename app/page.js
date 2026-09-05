export default function Home() {
  return (
    <div className="space-y-4">
      <div className="bg-[#181b21] rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-2">لوحة اليوم</h2>
        <p className="text-gray-400 text-sm">
          هنا هيظهر ملخص كل المواقع، التراجعات، والفرص — هنبنيها في الخطوة القادمة
          بعد ما نوصل GSC وGA4. دلوقتي ابدأ بإضافة مواقعك من صفحة "المواقع".
        </p>
        <a
          href="/sites"
          className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
        >
          + أضف موقع
        </a>
      </div>
    </div>
  );
}
