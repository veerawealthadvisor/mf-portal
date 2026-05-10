"use client";
import OnboardingForm from "./components/OnboardingForm";
import { useState, useEffect } from "react";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const whatsapp = () => {
    window.open("https://wa.me/918148582571?text=Hi%20Veera%20Karthik%2C%20I%20am%20interested%20in%20investing%20with%20you.", "_blank");
  };

  const services = [
    { icon: "📈", title: "SIP Planning", desc: "Start a Systematic Investment Plan from as little as ₹1,000/month and build wealth steadily over time." },
    { icon: "🎯", title: "Goal-Based Investing", desc: "Plan investments around your life goals — buying a home, children's education, or a dream vacation." },
    { icon: "🏖️", title: "Retirement Planning", desc: "Build a retirement corpus that lets you live comfortably without financial stress in your golden years." },
    { icon: "💰", title: "Tax Saving (ELSS)", desc: "Save up to ₹1.5 lakh in taxes under Section 80C while earning market-linked returns through ELSS funds." },
    { icon: "💎", title: "Wealth Management", desc: "Holistic portfolio management across mutual funds, asset classes, and risk profiles tailored to you." },
    { icon: "🌏", title: "NRI Investments", desc: "Seamless mutual fund investments for Non-Resident Indians. Invest in India from anywhere in the world." },
  ];

  const trust = [
    { number: "AMFI", label: "Registered Distributor", sub: "ARN: 355717" },
    { number: "₹1,000", label: "Start Investing From", sub: "Per month via SIP" },
    { number: "10+", label: "Fund Houses", sub: "SBI, HDFC, ICICI, PPFAS & more" },
    { number: "100%", label: "Transparent", sub: "No hidden charges" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy: #0a1628;
          --navy2: #0f1f3d;
          --gold: #c9a84c;
          --gold2: #e8c97a;
          --cream: #f5f0e8;
          --white: #ffffff;
          --text: #1a1a2e;
          --muted: #6b7280;
          --border: rgba(201,168,76,0.2);
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--text);
          overflow-x: hidden;
        }

        /* NAV */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 1.25rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          transition: all 0.3s ease;
        }
        nav.scrolled {
          background: rgba(10,22,40,0.97);
          backdrop-filter: blur(12px);
          padding: 0.85rem 2rem;
          box-shadow: 0 2px 30px rgba(0,0,0,0.3);
        }
        .nav-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.35rem; font-weight: 700;
          color: var(--gold2);
          letter-spacing: 0.02em;
          text-decoration: none;
        }
        .nav-links { display: flex; gap: 2rem; list-style: none; }
        .nav-links a {
          color: rgba(255,255,255,0.75);
          text-decoration: none; font-size: 0.85rem;
          font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: var(--gold2); }
        .nav-cta {
          background: var(--gold);
          color: var(--navy) !important;
          padding: 0.5rem 1.25rem !important;
          border-radius: 2px;
          font-weight: 500 !important;
          transition: background 0.2s !important;
        }
        .nav-cta:hover { background: var(--gold2) !important; color: var(--navy) !important; }
        .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; }
        .hamburger span { width: 24px; height: 1.5px; background: var(--gold2); display: block; transition: all 0.3s; }
        .nav-links.mobile-open {
  display: flex !important;
  flex-direction: column;
  position: fixed;
  top: 64px; left: 0; right: 0;
  background: rgba(10,22,40,0.98);
  padding: 1.5rem 2rem 2rem;
  gap: 1.25rem;
  z-index: 99;
  border-top: 1px solid rgba(201,168,76,0.2);
}

        /* HERO */
        .hero {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy2) 50%, #1a2744 100%);
          display: flex; align-items: center;
          position: relative; overflow: hidden;
          padding: 8rem 2rem 4rem;
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(201,168,76,0.05) 0%, transparent 50%);
        }
        .hero-grid {
          max-width: 1100px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 4rem; align-items: center;
          position: relative; z-index: 1;
        }
        .hero-tag {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid var(--border);
          padding: 0.4rem 1rem; border-radius: 2px;
          font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 1.5rem;
        }
        .hero-tag::before { content: ''; width: 6px; height: 6px; background: var(--gold); border-radius: 50%; }
        h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2.8rem, 5vw, 4.2rem);
          font-weight: 700; line-height: 1.1;
          color: var(--white); margin-bottom: 0.5rem;
        }
        h1 span { color: var(--gold2); font-style: italic; }
        .hero-sub {
          font-size: 1rem; color: rgba(255,255,255,0.6);
          margin-bottom: 0.75rem; letter-spacing: 0.05em;
          text-transform: uppercase; font-size: 0.8rem;
        }
        .arn-badge {
          display: inline-block;
          background: rgba(201,168,76,0.12);
          border: 1px solid var(--border);
          color: var(--gold);
          padding: 0.3rem 0.85rem;
          font-size: 0.78rem; letter-spacing: 0.08em;
          border-radius: 2px; margin-bottom: 1.75rem;
        }
        .hero-desc {
          font-size: 1.05rem; color: rgba(255,255,255,0.65);
          line-height: 1.8; margin-bottom: 2.5rem;
          font-weight: 300;
        }
        .hero-btns { display: flex; gap: 1rem; flex-wrap: wrap; }
        .btn-primary {
          background: var(--gold);
          color: var(--navy);
          padding: 0.85rem 2rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem; font-weight: 500;
          border: none; cursor: pointer; border-radius: 2px;
          letter-spacing: 0.03em;
          transition: all 0.2s;
        }
        .btn-primary:hover { background: var(--gold2); transform: translateY(-1px); }
        .btn-outline {
          background: transparent;
          color: var(--white);
          padding: 0.85rem 2rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem; font-weight: 400;
          border: 1px solid rgba(255,255,255,0.25); cursor: pointer; border-radius: 2px;
          transition: all 0.2s; text-decoration: none;
          display: inline-block;
        }
        .btn-outline:hover { border-color: var(--gold); color: var(--gold); }

        /* Hero visual */
        .hero-visual {
          display: flex; justify-content: center; align-items: center;
          position: relative;
        }
        .hero-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(201,168,76,0.25);
          border-radius: 4px;
          padding: 2.5rem;
          width: 100%; max-width: 380px;
          backdrop-filter: blur(10px);
        }
        .profile-ring {
          width: 100px; height: 100px;
          border-radius: 50%;
          border: 2px solid var(--gold);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.5rem;
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.2rem; font-weight: 700;
          color: var(--gold2);
          background: rgba(201,168,76,0.08);
        }
        .hero-card h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.5rem; color: var(--white);
          text-align: center; margin-bottom: 0.25rem;
        }
        .hero-card p {
          text-align: center; color: rgba(255,255,255,0.5);
          font-size: 0.8rem; letter-spacing: 0.05em;
          text-transform: uppercase; margin-bottom: 1.75rem;
        }
        .card-divider { height: 1px; background: var(--border); margin-bottom: 1.5rem; }
        .card-stat { display: flex; justify-content: space-between; margin-bottom: 0.85rem; }
        .card-stat-label { font-size: 0.78rem; color: rgba(255,255,255,0.45); }
        .card-stat-val { font-size: 0.85rem; color: var(--gold2); font-weight: 500; }
        .whatsapp-btn {
          width: 100%; margin-top: 1.5rem;
          background: #25D366; color: white;
          border: none; padding: 0.75rem;
          border-radius: 2px; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem; font-weight: 500;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.2s;
        }
        .whatsapp-btn:hover { background: #20ba59; }

        /* TRUST STRIP */
        .trust-strip {
          background: var(--navy);
          padding: 3rem 2rem;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .trust-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 2rem; text-align: center;
        }
        .trust-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.2rem; font-weight: 700;
          color: var(--gold2); line-height: 1;
          margin-bottom: 0.4rem;
        }
        .trust-label {
          font-size: 0.85rem; color: var(--white);
          font-weight: 500; margin-bottom: 0.2rem;
        }
        .trust-sub { font-size: 0.75rem; color: rgba(255,255,255,0.4); }

        /* ABOUT */
        .about {
          padding: 7rem 2rem;
          background: var(--cream);
        }
        .section-wrap { max-width: 1100px; margin: 0 auto; }
        .section-tag {
          font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 0.75rem;
          display: flex; align-items: center; gap: 8px;
        }
        .section-tag::before { content: ''; width: 24px; height: 1px; background: var(--gold); }
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
        h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 700; line-height: 1.2;
          color: var(--navy); margin-bottom: 1.5rem;
        }
        h2 em { color: var(--gold); font-style: italic; }
        .about-text {
          font-size: 1rem; color: var(--muted);
          line-height: 1.9; margin-bottom: 1.25rem; font-weight: 300;
        }
        .about-list { list-style: none; }
        .about-list li {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 0.6rem 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          font-size: 0.9rem; color: var(--text);
        }
        .about-list li::before { content: '✦'; color: var(--gold); font-size: 0.6rem; margin-top: 4px; flex-shrink: 0; }
        .about-highlight {
          background: var(--navy);
          border-radius: 4px; padding: 2.5rem;
          color: white;
        }
        .about-highlight h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.6rem; color: var(--gold2);
          margin-bottom: 1rem;
        }
        .about-highlight p { color: rgba(255,255,255,0.65); font-size: 0.9rem; line-height: 1.8; font-weight: 300; }
        .about-contact { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .about-contact a {
          color: var(--gold); font-size: 0.85rem; text-decoration: none;
          display: flex; align-items: center; gap: 8px;
          transition: color 0.2s;
        }
        .about-contact a:hover { color: var(--gold2); }

        /* SERVICES */
        .services {
          padding: 7rem 2rem;
          background: #f0ebe0;
        }
        .services-header { text-align: center; margin-bottom: 4rem; }
        .services-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        .service-card {
          background: var(--white);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 4px; padding: 2rem;
          transition: all 0.25s;
          position: relative; overflow: hidden;
        }
        .service-card::after {
          content: ''; position: absolute;
          bottom: 0; left: 0; right: 0; height: 3px;
          background: var(--gold);
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.3s;
        }
        .service-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.08); }
        .service-card:hover::after { transform: scaleX(1); }
        .service-icon { font-size: 1.75rem; margin-bottom: 1rem; }
        .service-card h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.3rem; font-weight: 700;
          color: var(--navy); margin-bottom: 0.75rem;
        }
        .service-card p { font-size: 0.875rem; color: var(--muted); line-height: 1.75; font-weight: 300; }

        /* WHY */
        .why {
          padding: 7rem 2rem;
          background: var(--navy);
        }
        .why-header { text-align: center; margin-bottom: 4rem; }
        .why-header h2 { color: var(--white); }
        .why-header h2 em { color: var(--gold2); }
        .why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
        .why-card {
          border: 1px solid var(--border);
          border-radius: 4px; padding: 2rem;
          transition: all 0.25s;
        }
        .why-card:hover { background: rgba(201,168,76,0.05); border-color: var(--gold); }
        .why-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 3rem; font-weight: 700;
          color: rgba(201,168,76,0.2); line-height: 1;
          margin-bottom: 0.75rem;
        }
        .why-card h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; color: var(--white);
          margin-bottom: 0.6rem;
        }
        .why-card p { font-size: 0.85rem; color: rgba(255,255,255,0.5); line-height: 1.75; font-weight: 300; }

        /* CONTACT */
        .contact {
          padding: 7rem 2rem;
          background: var(--cream);
        }
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: start; }
        .contact-info h2 { margin-bottom: 1rem; }
        .contact-info p { color: var(--muted); line-height: 1.8; font-size: 0.95rem; margin-bottom: 2rem; font-weight: 300; }
        .contact-methods { display: flex; flex-direction: column; gap: 1rem; }
        .contact-method {
          display: flex; align-items: center; gap: 1rem;
          padding: 1rem 1.25rem;
          background: white; border: 1px solid rgba(0,0,0,0.06);
          border-radius: 4px;
        }
        .contact-method-icon {
          width: 40px; height: 40px;
          background: rgba(201,168,76,0.1);
          border-radius: 2px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; flex-shrink: 0;
        }
        .contact-method-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .contact-method-val { font-size: 0.9rem; color: var(--navy); font-weight: 500; }
        .contact-form { background: white; border: 1px solid rgba(0,0,0,0.06); border-radius: 4px; padding: 2.5rem; }
        .contact-form h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.5rem; color: var(--navy); margin-bottom: 1.5rem;
        }
        .form-group { margin-bottom: 1.25rem; }
        .form-group label { display: block; font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; }
        .form-group input, .form-group textarea {
          width: 100%; padding: 0.75rem 1rem;
          border: 1px solid rgba(0,0,0,0.1); border-radius: 2px;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem;
          background: var(--cream);
          transition: border-color 0.2s; outline: none;
        }
        .form-group input:focus, .form-group textarea:focus { border-color: var(--gold); }
        .form-group textarea { resize: vertical; min-height: 100px; }
        .form-submit {
          width: 100%; background: var(--navy); color: white;
          border: none; padding: 0.9rem;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 500;
          border-radius: 2px; cursor: pointer; transition: background 0.2s;
          letter-spacing: 0.03em;
        }
        .form-submit:hover { background: var(--navy2); }

        /* FOOTER */
        footer {
          background: var(--navy);
          border-top: 1px solid var(--border);
          padding: 2rem;
          text-align: center;
        }
        .footer-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem; color: var(--gold2);
          margin-bottom: 0.5rem;
        }
        .footer-text { font-size: 0.78rem; color: rgba(255,255,255,0.35); line-height: 1.7; }
        .investor-login {
          display: inline-block; margin-top: 1rem;
          border: 1px solid var(--border);
          color: var(--gold); padding: 0.5rem 1.5rem;
          border-radius: 2px; font-size: 0.8rem; text-decoration: none;
          transition: all 0.2s;
        }
        .investor-login:hover { background: var(--gold); color: var(--navy); }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .hamburger { display: flex; }
          .hero-grid, .about-grid, .contact-grid { grid-template-columns: 1fr; gap: 2.5rem; }
          .hero-visual { display: none; }
          .trust-grid { grid-template-columns: repeat(2, 1fr); }
          .services-grid, .why-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav className={scrolled ? "scrolled" : ""}>
        <a href="#" className="nav-logo">Veera Karthik</a>
        <ul className={`nav-links ${menuOpen ? "mobile-open" : ""}`}>
  <li><a href="#about" onClick={() => setMenuOpen(false)}>About</a></li>
  <li><a href="#services" onClick={() => setMenuOpen(false)}>Services</a></li>
  <li><a href="#why" onClick={() => setMenuOpen(false)}>Why Me</a></li>
  <li><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a></li>
  <li><a href="/calculators" onClick={() => setMenuOpen(false)}>Calculators</a></li>
  <li><a href="/login" className="nav-cta" onClick={() => setMenuOpen(false)}>Investor Login</a></li>
</ul>
        <div className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-tag">Mutual Fund Distributor</div>
            <p className="hero-sub">AMFI Registered · ARN 355717</p>
            <h1>Veera Karthik<br /><span>Subburaj</span></h1>
            <div className="arn-badge">ARN: 355717 · Registered with AMFI</div>
            <p className="hero-desc">
              Helping individuals and families build long-term wealth through disciplined mutual fund investments. Start your journey with as little as ₹1,000 per month.
            </p>
            <div className="hero-btns">
              <button className="btn-primary" onClick={() => setShowForm(true)}>Start Investing Today</button>
              <a href="#services" className="btn-outline">View Services</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card">
              <div className="profile-ring">VK</div>
              <h3>Veera Karthik Subburaj</h3>
              <p>Mutual Fund Distributor</p>
              <div className="card-divider" />
              <div className="card-stat">
                <span className="card-stat-label">Registration</span>
                <span className="card-stat-val">AMFI Certified</span>
              </div>
              <div className="card-stat">
                <span className="card-stat-label">ARN Number</span>
                <span className="card-stat-val">355717</span>
              </div>
              <div className="card-stat">
                <span className="card-stat-label">Min. Investment</span>
                <span className="card-stat-val">₹1,000 / month</span>
              </div>
              <div className="card-stat">
                <span className="card-stat-label">Location</span>
                <span className="card-stat-val">Chennai, Tamil Nadu</span>
              </div>
              <button className="whatsapp-btn" onClick={whatsapp}>
                <span>💬</span> Chat on WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="trust-strip">
        <div className="trust-grid">
          {trust.map((t, i) => (
            <div key={i}>
              <div className="trust-num">{t.number}</div>
              <div className="trust-label">{t.label}</div>
              <div className="trust-sub">{t.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section className="about" id="about">
        <div className="section-wrap">
          <div className="about-grid">
            <div>
              <div className="section-tag">About Me</div>
              <h2>Your Trusted <em>Wealth</em> Partner</h2>
              <p className="about-text">
                I am Veera Karthik Subburaj, an AMFI-registered Mutual Fund Distributor based in Tamil Nadu. My mission is simple — to make investing accessible, understandable, and rewarding for every individual regardless of their financial background.
              </p>
              <p className="about-text">
                I believe that building wealth is not just for the wealthy. With the right guidance, disciplined SIPs, and a long-term mindset, anyone can achieve their financial goals.
              </p>
              <ul className="about-list">
                <li>AMFI Registered Mutual Fund Distributor (ARN: 355717)</li>
                <li>Personalized investment planning for every client</li>
                <li>Transparent fee structure with no hidden charges</li>
                <li>Regular portfolio reviews and performance updates</li>
                <li>Dedicated support via WhatsApp and email</li>
              </ul>
            </div>
            <div>
              <div className="about-highlight">
                <h3>Get in Touch</h3>
                <p>Ready to start your investment journey? I'm just a message away. Reach out via WhatsApp or email and I'll get back to you within 24 hours.</p>
                <div className="about-contact">
                  <a href="tel:8148582571">📞 8148582571</a>
                  <a href="mailto:veerawealthadvisor@gmail.com">✉️ veerawealthadvisor@gmail.com</a>
                </div>
                <button className="btn-primary" style={{marginTop: "1.5rem", width: "100%"}} onClick={whatsapp}>
                  Chat on WhatsApp →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="services" id="services">
        <div className="section-wrap">
          <div className="services-header">
            <div className="section-tag" style={{justifyContent:"center"}}>What I Offer</div>
            <h2>Services Tailored <em>For You</em></h2>
          </div>
          <div className="services-grid">
            {services.map((s, i) => (
              <div className="service-card" key={i}>
                <div className="service-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="why" id="why">
        <div className="section-wrap">
          <div className="why-header">
            <div className="section-tag" style={{justifyContent:"center", color:"var(--gold)"}}>Why Choose Me</div>
            <h2>Investing Made <em>Simple & Safe</em></h2>
          </div>
          <div className="why-grid">
            {[
              { n: "01", t: "AMFI Certified & Regulated", p: "I am registered with AMFI under ARN 355717. Every investment recommendation I make is compliant with SEBI regulations." },
              { n: "02", t: "Personalised Approach", p: "No two investors are the same. I take time to understand your goals, risk appetite, and timeline before recommending any fund." },
              { n: "03", t: "Complete Transparency", p: "I clearly explain all charges, commissions, and fund details upfront. You always know where your money is going." },
              { n: "04", t: "Ongoing Support", p: "My relationship with you doesn't end after investment. I provide regular updates, reviews, and am always available on WhatsApp." },
              { n: "05", t: "Start Small, Dream Big", p: "You can start investing with just ₹1,000 per month. SIPs make wealth building accessible to everyone." },
              { n: "06", t: "Your Own Dashboard", p: "Track your portfolio, see monthly performance, and run calculators — all in your personal investor dashboard." },
            ].map((w, i) => (
              <div className="why-card" key={i}>
                <div className="why-num">{w.n}</div>
                <h3>{w.t}</h3>
                <p>{w.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact" id="contact">
        <div className="section-wrap">
          <div className="contact-grid">
            <div className="contact-info">
              <div className="section-tag">Get In Touch</div>
              <h2>Let's Start Your <em>Journey</em></h2>
              <p>Have questions about mutual funds? Want to start a SIP? I'm here to help. Reach out through any channel and I'll respond promptly.</p>
              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-method-icon">📞</div>
                  <div>
                    <div className="contact-method-label">Phone / WhatsApp</div>
                    <div className="contact-method-val">8148582571</div>
                  </div>
                </div>
                <div className="contact-method">
                  <div className="contact-method-icon">✉️</div>
                  <div>
                    <div className="contact-method-label">Email</div>
                    <div className="contact-method-val">veerawealthadvisor@gmail.com</div>
                  </div>
                </div>
                <div className="contact-method">
                  <div className="contact-method-icon">🏛️</div>
                  <div>
                    <div className="contact-method-label">Registration</div>
                    <div className="contact-method-val">ARN: 355717 · AMFI Certified</div>
                  </div>
                </div>
              </div>
              <button className="btn-primary" style={{marginTop:"1.5rem"}} onClick={whatsapp}>
                💬 WhatsApp Me Now
              </button>
            </div>
            <div className="contact-form">
              <h3>Send a Message</h3>
              <div className="form-group">
                <label>Your Name</label>
                <input type="text" placeholder="Enter your full name" />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" placeholder="Your WhatsApp number" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea placeholder="Tell me about your investment goals..."></textarea>
              </div>
              <button className="form-submit" onClick={whatsapp}>
                Send via WhatsApp →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">Veera Karthik Subburaj</div>
        <p className="footer-text">
          AMFI Registered Mutual Fund Distributor · ARN: 355717<br />
          Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully.<br />
          © 2026 Veera Karthik Subburaj. All rights reserved.
        </p>
        <a href="/login" className="investor-login">Investor Login →</a>
      </footer>
      {showForm && <OnboardingForm onClose={() => setShowForm(false)} />}
    </>
  );
}
