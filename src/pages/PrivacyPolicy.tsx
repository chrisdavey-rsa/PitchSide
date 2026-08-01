import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PitchSideLogo from "../components/PitchSideLogo";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-emerald-400 mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <PitchSideLogo size="sm" />
        <h1 className="mt-6 text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-slate-500 font-mono uppercase tracking-widest">
          Last updated · August 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 font-sans leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">1. Who we are</h2>
            <p>
              PitchSide (“we”, “us”) operates the PitchSide sports prediction platform. Contact:{" "}
              <a href="mailto:admin@pitchside.pro" className="text-emerald-400 underline">
                admin@pitchside.pro
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">2. Data we collect</h2>
            <p>Depending on how you use the Service, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Account data: email, username, name, nationality, preferred sports, optional phone</li>
              <li>Profile preferences and supported team / favourites</li>
              <li>Prediction history, league memberships, power-up usage, and leaderboard stats</li>
              <li>Technical data: device/browser type, IP address, cookies or similar technologies</li>
              <li>Communications you send to us (e.g. support emails)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">3. How we use data</h2>
            <p>We use personal data to:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Operate the platform (accounts, predictions, leagues, scoring, leaderboards)</li>
              <li>Secure accounts, prevent abuse, and enforce our Terms</li>
              <li>Communicate service messages (verification, password reset, important updates)</li>
              <li>
                Improve the product and, where permitted, for commercial purposes including
                advertising, sponsorship, and marketing analytics
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">4. Children&apos;s privacy (13+)</h2>
            <p>
              PitchSide is intended for users aged 13 and over. We do not knowingly collect personal
              data from children under 13. If we learn an account belongs to someone under 13 without
              verified parental permission, we reserve the right to delete that account and associated
              data. Parents or guardians may email{" "}
              <a href="mailto:admin@pitchside.pro" className="text-emerald-400 underline">
                admin@pitchside.pro
              </a>{" "}
              to request review or confirmation of permission for an under-13 player.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">5. Sharing</h2>
            <p>
              We may share data with infrastructure and analytics providers who process it on our
              behalf, when required by law, or in connection with a business transfer. Public
              leaderboards and league standings may display your username and scores to other players.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">6. Retention &amp; security</h2>
            <p>
              We retain data for as long as needed to provide the Service and meet legal obligations.
              We use reasonable technical and organisational measures to protect data, but no method
              of transmission or storage is completely secure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">7. Your rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, delete, or restrict
              processing of your personal data. Contact{" "}
              <a href="mailto:admin@pitchside.pro" className="text-emerald-400 underline">
                admin@pitchside.pro
              </a>{" "}
              to make a request. See also our{" "}
              <Link to="/terms" className="text-emerald-400 underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">8. Changes</h2>
            <p>
              We may update this Privacy Policy from time to time. Continued use of the Service after
              changes means you accept the updated policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
