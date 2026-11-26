import "@/components/sites/intelic/intelic.css";
import { CookieBanner, Footer } from "@/components/sites/intelic/footer";
import { Missions } from "@/components/sites/intelic/missions";
import { About, Challenge, Hero, MeetNexus, Partners, Platform } from "@/components/sites/intelic/sections";
import { Topbar } from "@/components/sites/intelic/topbar";

export default function Home() {
  return (
    <div className="ic">
      <Topbar />
      <main className="ic-main">
        <Hero />
        <Challenge />
        <MeetNexus />
        <Platform />
        <Missions />
        <About />
        <Partners />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
