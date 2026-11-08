import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Christian Tutors | Grow in knowledge. Grounded in faith.",description:"Personal online tutoring from teachers with a Biblical worldview. Find your subject, your tutor, and your time."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
