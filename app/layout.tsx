import './globals.css';
import type { Metadata } from 'next';
import { SiteShell } from '../components/site-shell';
export const metadata: Metadata = {title:{default:'Vāchaspati AI — Voice infrastructure for every product',template:'%s | Vāchaspati AI'},description:'Developer-first voice infrastructure. Explore transcription, synthesis, multilingual routing, voice agents and API documentation.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><SiteShell>{children}</SiteShell></body></html>}
