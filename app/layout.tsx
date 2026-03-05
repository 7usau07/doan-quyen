import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NetworkRadar from "@/components/NetworkRadar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// CẤU HÌNH GIAO DIỆN APP ĐIỆN THOẠI (Xóa viền trắng Safari)
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// CẤU HÌNH NHẬN DIỆN APP THỰC THỤ CHUẨN PWA
export const metadata: Metadata = {
  title: "ĐOÀN QUYÊN | Hệ thống quản trị",
  description: "Phần mềm quản lý tổng thể kho, đơn hàng và tài chính nội bộ hệ thống Yến Sào Đoàn Quyên.",
  manifest: "/manifest.json", // Khai báo hộ khẩu cho App
  appleWebApp: {
    capable: true,
    title: "Đoàn Quyên",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* GẮN CỤC RADAR LÊN NÓC NHÀ ĐỂ NÓ CANH GÁC TOÀN BỘ TRANG WEB */}
        <NetworkRadar />
        
        {/* NỘI DUNG BÊN TRONG CỦA SẾP */}
        {children}
      </body>
    </html>
  );
}