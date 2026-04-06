import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfServicePage = () => {
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
          <h1 className="text-4xl font-semibold text-[#0A0A0A] mb-4">Terms of Service</h1>
          <p className="text-[#666666] mb-8">Last updated: April 6, 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">1. Acceptance of Terms</h2>
              <p className="text-[#666666] leading-relaxed">
                By accessing or using BookSlot's services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">2. Description of Service</h2>
              <p className="text-[#666666] leading-relaxed">
                BookSlot provides a cloud-based appointment scheduling and business management platform designed for service-based businesses including salons, clinics, dental practices, and other appointment-driven enterprises. Our services include online booking, calendar management, staff scheduling, client management, and AI-powered receptionist features.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">3. Account Registration</h2>
              <p className="text-[#666666] leading-relaxed mb-4">To use our services, you must:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li>Be at least 18 years of age or have legal parental or guardian consent</li>
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">4. Subscription and Payments</h2>
              <p className="text-[#666666] leading-relaxed mb-4">
                <strong>4.1 Pricing:</strong> Our services are offered on a subscription basis with pricing tiers as displayed on our website. Prices are subject to change with notice.
              </p>
              <p className="text-[#666666] leading-relaxed mb-4">
                <strong>4.2 Billing:</strong> Subscription fees are billed in advance on a monthly or annual basis depending on your selected plan. You authorize us to charge your designated payment method for all fees incurred.
              </p>
              <p className="text-[#666666] leading-relaxed mb-4">
                <strong>4.3 Refunds:</strong> Subscription fees are non-refundable except as required by law or as explicitly stated in writing.
              </p>
              <p className="text-[#666666] leading-relaxed">
                <strong>4.4 Cancellation:</strong> You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">5. Acceptable Use</h2>
              <p className="text-[#666666] leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 text-[#666666] space-y-2">
                <li>Use the service for any unlawful purpose or in violation of any applicable laws</li>
                <li>Transmit any harmful, threatening, abusive, or otherwise objectionable content</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                <li>Interfere with or disrupt the integrity or performance of the service</li>
                <li>Use automated means to access the service without our written permission</li>
                <li>Resell or redistribute our services without authorization</li>
                <li>Use the service to send spam or unsolicited communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">6. Data and Content</h2>
              <p className="text-[#666666] leading-relaxed mb-4">
                <strong>6.1 Your Data:</strong> You retain all rights to the data you input into our platform. You grant us a license to use, store, and process your data solely for the purpose of providing our services.
              </p>
              <p className="text-[#666666] leading-relaxed mb-4">
                <strong>6.2 Data Protection:</strong> We implement reasonable security measures to protect your data. However, you are responsible for maintaining the confidentiality of your account credentials.
              </p>
              <p className="text-[#666666] leading-relaxed">
                <strong>6.3 Data Export:</strong> You may export your data at any time through our platform's export functionality or by contacting support.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">7. Intellectual Property</h2>
              <p className="text-[#666666] leading-relaxed">
                The service and its original content, features, and functionality are owned by BookSlot and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our services without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">8. Third-Party Services</h2>
              <p className="text-[#666666] leading-relaxed">
                Our service may integrate with or contain links to third-party services. We are not responsible for the content, privacy policies, or practices of any third-party services. Your use of such services is at your own risk and subject to their respective terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">9. Disclaimer of Warranties</h2>
              <p className="text-[#666666] leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">10. Limitation of Liability</h2>
              <p className="text-[#666666] leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOOKSLOT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">11. Indemnification</h2>
              <p className="text-[#666666] leading-relaxed">
                You agree to indemnify, defend, and hold harmless BookSlot and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the service or your violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">12. Termination</h2>
              <p className="text-[#666666] leading-relaxed">
                We may terminate or suspend your account and access to the service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the service will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">13. Governing Law</h2>
              <p className="text-[#666666] leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of Ireland, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the service shall be subject to the exclusive jurisdiction of the courts of Ireland.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">14. Changes to Terms</h2>
              <p className="text-[#666666] leading-relaxed">
                We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting the new Terms on this page and updating the "Last updated" date. Your continued use of the service after such modifications constitutes your acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-4">15. Contact Us</h2>
              <p className="text-[#666666] leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
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

export default TermsOfServicePage;
