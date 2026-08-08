import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PitchSideLogo from "../components/PitchSideLogo";

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-xs text-slate-500 font-mono uppercase tracking-widest">
          Last updated · August 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 font-sans leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using PitchSide (“the Service”), you agree to these Terms of
              Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">2. Eligibility (13+)</h2>
            <p>
              You must be at least 13 years of age to use PitchSide. If you are under 13, a parent or
              guardian must contact{" "}
              <a href="mailto:admin@pitchside.pro" className="text-emerald-400 underline">
                admin@pitchside.pro
              </a>{" "}
              to confirm permission before you may play. We may suspend or delete accounts that
              violate this requirement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">3. The Service</h2>
            <p>
              PitchSide is a sports prediction and social competition platform. Features may include
              score predictions, private and global leagues, chips, leaderboards, and related
              tools. Features may change, be added, or be withdrawn at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">4. Accounts &amp; Conduct</h2>
            <p>
              You are responsible for safeguarding your login credentials and for activity under your
              account. You agree not to harass others, cheat, exploit bugs, manipulate results, create
              fake accounts, or otherwise disrupt fair play or community standards.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">5. Finality of Scoring</h2>
            <p>
              All scoring settlements, game mechanic outcomes (including chips), and leaderboard
              rankings determined by PitchSide&apos;s logic and third-party data providers are final
              and cannot be disputed. Fixture data, live scores, and results may be corrected after
              publication when source data changes; your standing may update accordingly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">6. Limitation of Liability</h2>
            <p>
              The Service is provided “as is” and “as available” without warranties of any kind,
              express or implied. To the fullest extent permitted by law, PitchSide and its operators
              are not liable for app downtime, data loss, service interruptions, delayed or incorrect
              third-party sports data, or software bugs affecting gameplay, points, or rankings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">7. Account Termination</h2>
            <p>
              PitchSide reserves the right to suspend or terminate accounts immediately for exploiting
              bugs, abusive behaviour, fraud, or violating these Terms or community guidelines, with
              or without prior notice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">8. Intellectual Property</h2>
            <p>
              PitchSide branding, UI, and original content remain our property. You retain rights to
              content you submit (such as display names) and grant us a licence to use it to operate
              the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">9. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of England and
              Wales. Courts of England and Wales have exclusive jurisdiction, subject to any
              mandatory consumer protections that apply to you.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-display font-bold text-white">10. Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:admin@pitchside.pro" className="text-emerald-400 underline">
                admin@pitchside.pro
              </a>
              . See also our{" "}
              <Link to="/privacy" className="text-emerald-400 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
