import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const updated = '15 July 2026'
const contact = 'rkdevanda65@gmail.com'

function Shell({ title, children }) {
  useEffect(() => {
    document.title = `${title} · Crickrida`
  }, [title])

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#E8E8ED] px-5 py-10 sm:px-8">
      <article className="max-w-3xl mx-auto rounded-2xl border border-[#1E1E2A] bg-[#111118] p-6 sm:p-10 shadow-2xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-accent-cyan text-sm mb-8 hover:underline">
          ← Back to Crickrida
        </Link>
        <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-2">{title}</h1>
        <p className="text-text-muted text-sm mb-9">Last updated: {updated}</p>
        <div className="legal-copy space-y-7 text-text-secondary leading-7">{children}</div>
      </article>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xl font-heading font-semibold text-text-primary mb-2">{title}</h2>
      {children}
    </section>
  )
}

export function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <p>
        Crickrida provides cricket statistics, analytics, AI-assisted insights, and tools for creating shareable stat cards.
        This policy explains what information Crickrida processes and the choices available to you.
      </p>

      <Section title="Information we process">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong className="text-text-primary">Account information:</strong> name, email address, authentication provider, encrypted password credentials, account plan, and session tokens when you create or use an account.</li>
          <li><strong className="text-text-primary">Feature usage:</strong> limited usage records for quota-controlled features such as AI queries, captions, threads, and generated images.</li>
          <li><strong className="text-text-primary">Content you submit:</strong> cricket questions, prompts, captions, or draft text only when you choose to use the relevant AI or creation feature.</li>
          <li><strong className="text-text-primary">Technical requests:</strong> standard server logs may temporarily include request time, route, device/browser information, and network address for reliability and security.</li>
        </ul>
      </Section>

      <Section title="How information is used">
        <p>We use information to authenticate accounts, deliver requested analytics and AI features, enforce feature limits, secure the service, diagnose failures, and improve reliability. Crickrida does not sell personal information or use third-party advertising trackers.</p>
      </Section>

      <Section title="Service providers and sharing">
        <p>Data is shared only when necessary to operate a feature you request, such as hosting, authentication, payment processing on the website, or an AI processing provider. These providers process information on our behalf under their own security and privacy obligations. Public cricket facts and statistics are not personal account data.</p>
      </Section>

      <Section title="Photos and device permissions">
        <p>The mobile app requests photo-library access only when you choose to save a generated stat card. Sharing uses the operating system share sheet. Crickrida does not access your location, contacts, microphone, or camera.</p>
      </Section>

      <Section title="Retention and deletion">
        <p>Account information is retained while your account is active. Expired sessions and temporary generated files are removed or overwritten during normal operation. You can permanently delete your account and associated account-linked usage records from the mobile app under More → Account → Delete account. You can also review the <Link to="/account-deletion" className="text-accent-cyan hover:underline">account deletion page</Link>.</p>
      </Section>

      <Section title="Security and your choices">
        <p>Crickrida uses encrypted HTTPS connections and stores mobile session credentials in the operating system’s secure storage. No method is completely risk-free. You may use most public analytics without an account, sign out at any time, or delete your account.</p>
      </Section>

      <Section title="Children">
        <p>Crickrida is a general-audience sports analytics product and is not directed to children under 13. If you believe a child has provided personal information, contact us so it can be removed.</p>
      </Section>

      <Section title="Contact">
        <p>For privacy questions, email <a className="text-accent-cyan hover:underline" href={`mailto:${contact}`}>{contact}</a>.</p>
      </Section>
    </Shell>
  )
}

export function TermsOfUse() {
  return (
    <Shell title="Terms of Use">
      <p>By using Crickrida, you agree to these terms. If you do not agree, do not use the service.</p>

      <Section title="The service">
        <p>Crickrida provides historical cricket data, statistical analysis, AI-assisted answers, and creative tools. Features may change as the product and underlying data improve.</p>
      </Section>

      <Section title="Accounts">
        <p>You are responsible for information submitted through your account and for keeping your credentials secure. Do not create accounts using another person’s identity, attempt to bypass limits, or interfere with the service. You may delete your account at any time.</p>
      </Section>

      <Section title="Acceptable use">
        <p>Do not use Crickrida to break laws, attack systems, scrape the service at abusive volume, publish unlawful or harmful content, impersonate others, or infringe intellectual-property rights. We may restrict abusive access to protect users and the service.</p>
      </Section>

      <Section title="Statistics and AI output">
        <p>Statistics and AI-generated responses are provided for information and entertainment. They may contain errors or omissions and should be independently verified before use in journalism, wagering, financial decisions, or other high-stakes contexts. Crickrida does not provide betting advice.</p>
      </Section>

      <Section title="Your content">
        <p>You retain rights to text and designs you create. You grant Crickrida the limited permission needed to process that content and deliver the feature you requested. You are responsible for ensuring you have the right to publish or share your output.</p>
      </Section>

      <Section title="Availability and liability">
        <p>The service is provided “as is” and “as available” to the extent permitted by law. We do not promise uninterrupted availability or perfect accuracy. To the maximum extent permitted by law, Crickrida is not liable for indirect or consequential losses arising from use of the service.</p>
      </Section>

      <Section title="Independent product">
        <p>Crickrida is an independent cricket analytics product. It is not affiliated with, endorsed by, or sponsored by the Board of Control for Cricket in India, the Indian Premier League, participating franchises, or players. Names and statistics are used descriptively.</p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms can be sent to <a className="text-accent-cyan hover:underline" href={`mailto:${contact}`}>{contact}</a>.</p>
      </Section>
    </Shell>
  )
}

export function AccountDeletion() {
  const subject = encodeURIComponent('Crickrida account deletion request')
  const body = encodeURIComponent('Please delete my Crickrida account associated with this email address.\n\nAccount email: ')
  return (
    <Shell title="Delete Your Crickrida Account">
      <p>Crickrida lets every account holder permanently delete their account and account-linked data.</p>
      <Section title="Delete in the mobile app">
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open Crickrida and sign in.</li>
          <li>Open <strong className="text-text-primary">More</strong>, then find the Account section.</li>
          <li>Tap <strong className="text-text-primary">Delete account</strong>, review what will be removed, and confirm.</li>
        </ol>
        <p className="mt-3">The signed-in deletion flow permanently removes the account, active sessions, and associated feature-usage records immediately.</p>
      </Section>
      <Section title="Request deletion without the app">
        <p>If you no longer have access to the app, email us from the address associated with your account. We may ask you to verify ownership before deletion.</p>
        <a
          className="inline-flex mt-4 rounded-xl bg-accent-cyan text-[#0A0A0F] font-semibold px-5 py-3 hover:brightness-110"
          href={`mailto:${contact}?subject=${subject}&body=${body}`}
        >
          Request account deletion
        </a>
      </Section>
      <Section title="What is deleted">
        <p>Your profile, login sessions, and account-linked usage records are deleted. Public cricket data is not tied to your account. Files already saved to your device or content you previously shared outside Crickrida remain under your control.</p>
      </Section>
    </Shell>
  )
}
