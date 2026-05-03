import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
            <p>Last updated: {lastUpdated}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using Deal Hunter, you agree to these Terms of Service. If you do not
              agree, do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Deal Hunter is an AI-powered real estate investment platform. We aggregate publicly available property
              data and apply AI analysis to score and evaluate distressed properties. Our reports are informational only — they are not
              financial, legal, or investment advice. Use them as one input among many in your decision-making.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Accounts and Credits</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be 18 or older to create an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>Credits are non-refundable except as required by law or at our discretion</li>
              <li>Credits purchased do not expire, but credits included with subscriptions reset monthly</li>
              <li>We reserve the right to suspend accounts that violate these terms</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the service to generate reports for illegal purposes</li>
              <li>Attempt to reverse-engineer or scrape the service at scale</li>
              <li>Resell or white-label reports without explicit written permission (Agency plan includes limited resale rights)</li>
              <li>Submit abusive, harmful, or harassing content</li>
              <li>Use automated means to create accounts or submit ideas in bulk beyond your plan limits</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Intellectual Property</h2>
            <p>
              The Deal Hunter platform, branding, and underlying software are our intellectual property.
              Reports generated for you are yours to use for your own business purposes. We retain a
              license to use anonymized, aggregated report data to improve the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THE
              ACCURACY, COMPLETENESS, OR FITNESS FOR ANY PARTICULAR PURPOSE OF THE REPORTS GENERATED.
              MARKET DATA FROM THIRD-PARTY SOURCES MAY BE DELAYED, INCOMPLETE, OR INACCURATE.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, GOLD RUSH SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING FROM YOUR
              USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID IN THE 12
              MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Subscriptions and Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
              <li>You can cancel at any time via the Settings page — your plan remains active until period end</li>
              <li>Refunds for subscription payments are at our discretion</li>
              <li>Prices may change with 30 days notice to existing subscribers</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
            <p>
              You may delete your account at any time via Settings. We may suspend or terminate your account
              for violations of these terms, with or without notice. Upon termination, your data will be deleted
              within 90 days per our Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
            <p>
              We may update these terms. Material changes will be communicated by email at least 14 days
              before taking effect. Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
            <p>
              These terms are governed by applicable law. Any disputes shall be resolved through binding
              arbitration or small claims court, waiving class action rights.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
            <p>
              Questions about these terms? Email{" "}
              <a href="mailto:yaronmadmon@gmail.com" className="underline text-foreground">yaronmadmon@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
