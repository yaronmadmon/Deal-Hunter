import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = "March 24, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-8 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p>Last updated: {lastUpdated}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Who We Are</h2>
            <p>
              Gold Rush ("we", "us", "our") is a startup idea validation platform. Our service helps founders
              validate business ideas using real market data from public sources. We are the data controller
              for the personal data we process.
            </p>
            <p>Contact: <a href="mailto:privacy@goldrushapp.live" className="underline text-foreground">privacy@goldrushapp.live</a></p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Account data:</strong> email address, display name, hashed password</li>
              <li><strong className="text-foreground">Usage data:</strong> pages visited, features used, analyses run, session duration</li>
              <li><strong className="text-foreground">Billing data:</strong> Stripe customer ID, subscription plan (we never store card numbers)</li>
              <li><strong className="text-foreground">Analysis content:</strong> the ideas you submit for validation and the resulting reports</li>
              <li><strong className="text-foreground">Technical data:</strong> IP address, browser type, device type (via standard web logs)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and improve the Gold Rush service</li>
              <li>To send transactional emails (account confirmation, analysis results, receipts)</li>
              <li>To process payments via Stripe</li>
              <li>To detect and prevent abuse or fraud</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p>We do not sell your data to third parties. We do not use your ideas for AI training.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Legal Basis (GDPR)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Contract performance:</strong> account management, delivering analysis results</li>
              <li><strong className="text-foreground">Legitimate interests:</strong> analytics, security monitoring</li>
              <li><strong className="text-foreground">Consent:</strong> marketing emails (you can withdraw at any time)</li>
              <li><strong className="text-foreground">Legal obligation:</strong> tax records, fraud prevention</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active plus 90 days after deletion.
              Billing records are kept for 7 years as required by law. Analytics events are retained for 12 months.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Third-Party Services</h2>
            <p>We share data with these processors:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Supabase</strong> — database and authentication hosting (EU/US)</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing</li>
              <li><strong className="text-foreground">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-foreground">OpenAI</strong> — AI analysis (your idea text is sent to OpenAI)</li>
              <li><strong className="text-foreground">Perplexity, Serper, Firecrawl</strong> — market data APIs</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
            <p>Under GDPR and CCPA, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Export your data in a portable format</li>
              <li>Object to processing based on legitimate interests</li>
              <li>Withdraw consent for marketing emails at any time</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@goldrushapp.live" className="underline text-foreground">privacy@goldrushapp.live</a>{" "}
              or use the account deletion option in Settings. We will respond within 30 days.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Cookies</h2>
            <p>We use the following cookies:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Essential:</strong> authentication session token (required to stay logged in)</li>
              <li><strong className="text-foreground">Analytics:</strong> session ID stored in sessionStorage to measure usage (no cross-site tracking)</li>
            </ul>
            <p>We do not use third-party advertising cookies.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Security</h2>
            <p>
              All data is encrypted in transit (TLS 1.2+) and at rest. Passwords are never stored in plaintext.
              Access to production databases is restricted and audited.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this policy. If changes are material, we will notify you by email or a prominent
              notice on the app at least 14 days before they take effect.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:privacy@goldrushapp.live" className="underline text-foreground">privacy@goldrushapp.live</a>.
              You also have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
