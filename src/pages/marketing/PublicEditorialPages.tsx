import { tdePhoto, schoolPhotos } from "@/lib/tdeMedia";
import { SchoolPhoto } from "@/components/marketing/SchoolPhoto";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageMeta } from "@/components/marketing/PageMeta";
import { MotionMedia } from "@/components/marketing/MotionMedia";
import { usePublicSchool } from "@/hooks/usePublicSchool";
import { defaultPublicContact } from "@/lib/publicSchool";

function EditorialPage({ title, description, eyebrow, heading, children }: {
  title: string;
  description: string;
  eyebrow: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <article className="tde-directory tde-paper tde-editorial">
      <PageMeta title={title} description={description} path={pathname} />
      <header className="tde-page-top">
        <span className="tde-eyebrow">{eyebrow}</span>
        <h1>{heading}</h1>
        <p>{description}</p>
      </header>
      {children}
    </article>
  );
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="tde-text-link" to={to}>{children}<ArrowUpRight size={18} aria-hidden /></Link>;
}

const information = [
  {
    title: "Find the right class",
    copy: "Search by age group, day or location. Each class page shows its current timetable, age guidance, venue and available booking options.",
    to: "/classes", label: "Explore classes",
  },
  {
    title: "Prices & trials",
    copy: "Prices and payment plans depend on the class. Check its booking page for the available plans and any trial option before choosing your place.",
    to: "/classes", label: "See current options",
  },
  {
    title: "Dates for your diary",
    copy: "Use the school calendar for term dates and holidays. Individual class pages show upcoming sessions, and your account holds your bookings.",
    to: "/term-dates", label: "View term dates",
  },
  {
    title: "Before your first session",
    copy: "Ask the team about suitable clothing, footwear, arrival arrangements or any support your dancer needs. Venue pages include the visitor information available for that location.",
    to: "/venues", label: "Find your venue",
  },
  {
    title: "Your bookings",
    copy: "Sign in to the account you used to book to see your classes and manage your details. Contact the team if you need help with an existing booking.",
    to: "/account/bookings", label: "Open your account",
  },
  {
    title: "Policies & questions",
    copy: "For the school's current safeguarding, privacy, cancellation or refund policies, please contact the team. Booking terms are presented during the booking journey.",
    to: "/contact", label: "Speak to the team",
  },
];

export default function PublicEditorialPages() {
  const { pathname } = useLocation();
  const { data: school } = usePublicSchool();
  const contact = school?.contact ?? defaultPublicContact;

  if (pathname === "/contact") return (
    <EditorialPage title="Get in touch" eyebrow="Start a conversation" heading={<>Let's<br /><em>talk dance.</em></>}
      description="A first class, a new challenge or something you have in mind. Get in touch with The Dance Exclusive team.">
      <div className="tde-editorial-split">
        <div className="tde-contact-links">
          <a href={`mailto:${contact.email}`}><span className="tde-eyebrow">Email the team</span><strong>{contact.email}</strong><ArrowUpRight aria-hidden /></a>
          <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}><span className="tde-eyebrow">Give us a call</span><strong>{contact.phone}</strong><ArrowUpRight aria-hidden /></a>
          <div className="tde-contact-socials">
            <a href={contact.instagram} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={18} aria-hidden /></a>
            <a href={contact.facebook} target="_blank" rel="noreferrer">Facebook <ArrowUpRight size={18} aria-hidden /></a>
          </div>
        </div>
        <div className="tde-editorial-copy">
          <h2>Your next<br />move starts here.</h2>
          <p>Looking for a class? Tell us the dancer's age, their experience and the area that works for you. We can help you find a place to start.</p>
          <TextLink to="/classes">Browse current classes</TextLink>
          <TextLink to="/parties">Plan a dance party</TextLink>
          <TextLink to="/schools">Dance at your school</TextLink>
        </div>
      </div>
    </EditorialPage>
  );

  if (pathname === "/about") return (
    <EditorialPage title="Our school" eyebrow="The Dance Exclusive · Essex" heading={<>More than<br /><em>the moves.</em></>}
      description="Commercial and street dance. Confidence, creativity and a place to belong. This is The Dance Exclusive.">
      <div className="tde-editorial-split">
        <MotionMedia className="tde-editorial-photo" image={tdePhoto("take-a-bow").src} alt={tdePhoto("take-a-bow").alt} />
        <div className="tde-editorial-copy">
          <span className="tde-eyebrow">Our school. Your people.</span>
          <h2>Come as you are.<br />Grow from here.</h2>
          <p>Led by founder and principal Amie Whitaker, The Dance Exclusive brings commercial and street dance to children, adults and schools across Essex.</p>
          <p>Our classes make room for self-expression, teamwork and the confidence that comes from trying something new. From your first steps to performing with a crew, there is more than one way to find your movement.</p>
          <TextLink to="/classes">Find your class</TextLink>
          <TextLink to="/venues">Explore our locations</TextLink>
        </div>
      </div>
      <div className="tde-editorial-links">
        <TextLink to="/team">Meet the teaching team</TextLink>
        <TextLink to="/results">Competition teams</TextLink>
        <TextLink to="/gallery">Life at The Dance Exclusive</TextLink>
      </div>
    </EditorialPage>
  );

  if (pathname === "/schools") return (
    <article className="tde-schools-page">
      <PageMeta title="Dance for schools in Essex" description="Dance sessions for Essex schools: PPA cover, clubs, themed workshops, choreography and teacher development." path="/schools" />
      <header className="tde-schools-hero">
        <MotionMedia image="/media/tde-schools-banner.jpg" alt="The Dance Exclusive school dancers celebrating together in their classroom" eager travel={25} />
        <div className="tde-schools-hero-shade" />
        <div><span className="tde-eyebrow">Confidence. Creativity. A whole lot of energy.</span><h1>Dance for schools<br /><em>in Essex.</em></h1></div>
      </header>
      <section className="tde-schools-intro">
        <div>
          <span className="tde-eyebrow">Bring movement into the school day</span>
          <h2>Big smiles.<br /><em>Brilliant moves.</em></h2>
          <p>From PE and PPA cover to clubs and special events, we bring dance into schools across Essex. Our experienced, DBS-checked teachers help pupils build confidence, creativity and teamwork while staying active.</p>
          <p>One-off workshops or regular sessions, shaped around your pupils' ages, abilities and school timetable.</p>
          <a className="tde-button" href={`mailto:${contact.email}?subject=School%20dance%20enquiry`}>Enquire about school sessions <ArrowUpRight size={20} aria-hidden /></a>
        </div>
        <MotionMedia className="tde-schools-group" image="/media/tde-schools-group.jpg" alt="The Dance Exclusive school dance group celebrating a performance together" travel={30} />
      </section>
      <section className="tde-schools-services" aria-labelledby="school-services-title">
        <div className="tde-section-heading"><h2 id="school-services-title">Your school.<br /><em>Your way to move.</em></h2></div>
        <div className="tde-school-service-grid">
          {[
            ["PPA cover", "Regular dance sessions as part of your school's provision."],
            ["Clubs", "Breakfast, lunchtime and after-school dance."],
            ["Themed workshops", "One-off sessions to bring a topic or special day to life."],
            ["Shows & choreography", "Routines for school events, performances and competitions."],
            ["Teacher development", "Dance education and training for your staff."],
          ].map(([title, copy], i) => <div key={title}><span aria-hidden="true">0{i + 1} ↗</span><h3>{title}</h3><p>{copy}</p></div>)}
        </div>
      </section>
      <section className="tde-schools-questions" aria-label="School session questions">
        <h2>A few things<br /><em>to know.</em></h2>
        <div>
          {[
            ["Can we book a one-off workshop?", "Yes. We offer both one-off workshops and ongoing sessions."],
            ["Are teachers DBS-checked?", "Yes, all teachers are DBS-checked."],
            ["Can sessions suit different ages?", "Yes. Sessions are adapted for different ages and abilities."],
          ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>
      <section className="tde-schools-enquiry">
        <h2>Let's get your<br />school moving.</h2>
        <a className="tde-button" href={`mailto:${contact.email}?subject=School%20dance%20enquiry`}>Get in touch <ArrowUpRight size={22} aria-hidden /></a>
      </section>
    </article>
  );

  if (pathname === "/results") return (
    <EditorialPage title="Competition teams & achievements" eyebrow="Take it to the stage" heading={<>All the work.<br /><em>ALL the feeling.</em></>}
      description="Training together. Performing together. Our competition teams give existing dancers a way to take their commitment further.">
      <div className="tde-editorial-split">
        <MotionMedia className="tde-editorial-photo" image={tdePhoto("competition-crew").src} alt={tdePhoto("competition-crew").alt} />
        <div className="tde-editorial-copy">
          <h2>Moments<br />to remember.</h2>
          <ul className="tde-awards-list">
            <li><span>2025</span><strong>U14 Beginner Crew National Champions</strong></li>
            <li><span>2025</span><strong>National Entertainment Awards SEEA · Best U10 Soloist</strong></li>
            <li><span>2024</span><strong>National Entertainment Awards SEEA · Best U18 Soloist</strong></li>
            <li><span>2024</span><strong>Small Business Awards · Arts / Creative winner</strong></li>
          </ul>
          <p>Interested in the competition pathway? Speak to the team about current opportunities and the training involved.</p>
          <TextLink to="/contact">Talk to the team</TextLink>
        </div>
      </div>
    </EditorialPage>
  );

  if (pathname === "/gallery") return (
    <EditorialPage title="Life at The Dance Exclusive" eyebrow="In the moment" heading={<>Feel the<br /><em>energy.</em></>}
      description="A glimpse of the people, performances and shared moments that make The Dance Exclusive.">
      <figure className="tde-gallery-film">
        <video controls playsInline muted preload="none" poster="/media/tde-film-poster.jpg" aria-label="The Dance Exclusive group dance performance, silent film">
          <source src="/media/tde-hero-film.mp4" type="video/mp4" />
        </video>
        <figcaption>In performance · The Dance Exclusive. Silent film.</figcaption>
      </figure>
      <div className="tde-gallery-grid tde-photo-gallery">
        {schoolPhotos.map(photo => <figure key={photo.key}>
          <SchoolPhoto photo={photo} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw" />
        </figure>)}
      </div>
      <TextLink to="/classes">Be part of it</TextLink>
    </EditorialPage>
  );

  return (
    <EditorialPage title="Useful information for dancers & parents" eyebrow="Before you join us" heading={<>Ready for<br /><em>your first move?</em></>}
      description="A few useful starting points for dancers and parents. Everything you need to find your class and feel prepared.">
      <div className="tde-information-grid">
        {information.map((item, index) => <section key={item.title}><span className="tde-eyebrow">0{index + 1}</span><h2>{item.title}</h2><p>{item.copy}</p><TextLink to={item.to}>{item.label}</TextLink></section>)}
      </div>
    </EditorialPage>
  );
}
