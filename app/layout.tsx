import './globals.css';

export const metadata = { title: 'ByBit — Virtual Card' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adminUrl = process.env.NEXT_PUBLIC_BITCART_ADMIN_URL || 'https://pay.bybitpay.pro';
  const modalSrc = `${adminUrl.replace(/\/$/, '')}/modal/bitcart.js`;
  return (
    <html lang="ru">
      <body>
        {children}
        <script src={modalSrc} async></script>
      </body>
    </html>
  );
}
