import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { MotionMedia } from "./MotionMedia";
import { coachPath, type PublicCoach } from "@/lib/publicSchool";
import { publicCoachTitle } from "@/lib/publicCoaches";
import { coachPhotoUrl } from "@/lib/staffPhoto";

export function FounderSpotlight({ coach, active = true }: { coach: PublicCoach; active?: boolean }) {
  const image = coachPhotoUrl(coach.profile_photo);
  const introduction = coach.description?.trim().split(/\n\s*\n/)[0];
  return (
    <article className="tde-founder-feature" aria-label={`${coach.first_name}, Founder`} data-entrance="">
      <header>
        <span className="tde-founder-label">Founder</span>
        <h2>{coach.first_name}<span>.</span></h2>
      </header>
      <div className="tde-founder-layout">
        <p className="tde-founder-statement">A place to grow.<br />A team to believe<br />in you.</p>
        <Link to={coachPath(coach)} className="tde-founder-portrait" aria-label={`Meet ${coach.first_name}, Founder`}>
          {image ? (
            <MotionMedia image={image} alt={`${coach.first_name}, Founder of The Dance Exclusive`} active={active} travel={0} />
          ) : (
            <div className="tde-no-image"><span>{coach.first_name?.[0]}</span></div>
          )}
        </Link>
        <div className="tde-founder-story">
          {introduction && <p>{introduction}</p>}
          <Link className="tde-text-link" to={coachPath(coach)}>
            Meet {coach.first_name} <ArrowUpRight size={20} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CoachCard({ coach, active = true, index = 0 }: { coach: PublicCoach; active?: boolean; index?: number }) {
  const image = coachPhotoUrl(coach.profile_photo);
  return (
    <Link to={coachPath(coach)} className="tde-coach-card" data-entrance="" data-delay={index * 60}>
      <div className="tde-coach-photo">
        {image ? (
          <MotionMedia image={image} alt={`${coach.first_name}, ${publicCoachTitle(coach)}`} active={active} travel={0} />
        ) : (
          <div className="tde-no-image"><span>{coach.first_name?.[0]}</span></div>
        )}
      </div>
      <div><h3>{coach.first_name}</h3><ArrowUpRight size={22} aria-hidden /></div>
      <p className="tde-coach-role">{publicCoachTitle(coach)}</p>
      {!!coach.dance_skills?.length && <p>{coach.dance_skills.slice(0, 3).join(" / ")}</p>}
    </Link>
  );
}
