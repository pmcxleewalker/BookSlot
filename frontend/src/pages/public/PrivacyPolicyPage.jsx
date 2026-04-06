import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold text-[#0A0A0A]">
            BookSlot
          </Link>
          <Link to="/" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-semibold text-[#0A0A0A] mb-4">Privacy Policy</h1>
          <p className="text-[#666666] mb-8">Last updated: April 6, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">1. Introduction</h2>
              <p className="text-[#666666] leading-relaxed">
                BookSlot ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our booking management platform and related services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">2. Information We Collect</h2>
              <p className="text-[#666666] leading-relaxed mb-4">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li><strong>Account Information:</strong> Name, email address, phone number, and business details when you create an account.</li>
                <li><strong>Booking Information:</strong> Appointment details, client information, staff schedules, and service records.</li>
                <li><strong>Payment Information:</strong> Billing details and payment method information (processed securely through third-party payment processors).</li>
                <li><strong>Communications:</strong> Messages, feedback, and support requests you send to us.</li>
                <li><strong>Usage Data:</strong> Information about how you interact with our platform, including log data and device information.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">3. How We Use Your Information</h2>
              <p className="text-[#666666] leading-relaxed mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process bookings and manage appointments</li>
                <li>Send appointment reminders and notifications</li>
                <li>Respond to your comments, questions, and support requests</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Detect, prevent, and address technical issues and security threats</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">4. Information Sharing</h2>
              <p className="text-[#666666] leading-relaxed mb-4">We do not sell your personal information. We may share your information only in the following circumstances:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li><strong>With Service Providers:</strong> Third-party vendors who assist us in providing our services (e.g., hosting, payment processing).</li>
                <li><strong>Between Businesses and Clients:</strong> Booking information shared between service providers and their clients to facilitate appointments.</li>
                <li><strong>For Legal Reasons:</strong> When required by law or to protect our rights, privacy, safety, or property.</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">5. Data Security</h2>
              <p className="text-[#666666] leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security assessments. However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">6. Data Retention</h2>
              <p className="text-[#666666] leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">7. Your Rights (GDPR)</h2>
              <p className="text-[#666666] leading-relaxed mb-4">If you are in the European Economic Area (EEA), you have certain data protection rights:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li><strong>Access:</strong> Request access to your personal data.</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate data.</li>
                <li><strong>Erasure:</strong> Request deletion of your personal data.</li>
                <li><strong>Restriction:</strong> Request restriction of processing your data.</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service.</li>
                <li><strong>Objection:</strong> Object to processing of your personal data.</li>
              </ul>
              <p className="text-[#666666] leading-relaxed mt-4">
                To exercise these rights, please contact us at <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">8. Cookies and Tracking</h2>
              <p className="text-[#666666] leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, some features may not function properly without cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">9. Children's Privacy</h2>
              <p className="text-[#666666] leading-relaxed">
                Our services are not intended for individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected personal information from a child under 16, we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">10. Changes to This Policy</h2>
              <p className="text-[#666666] leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">11. Contact Us</h2>
              <p className="text-[#666666] leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-[#666666] mt-4">
                <strong>Email:</strong> <a href="mailto:lee.quickwing@gmail.com" className="text-[#E34A33] hover:underline">lee.quickwing@gmail.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#E5E5E5]">
        <div className="max-w-3xl mx-auto flex justify-between items-center text-sm text-[#666666]">
          <span>© 2026 BookSlot. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-[#0A0A0A]">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#0A0A0A]">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
