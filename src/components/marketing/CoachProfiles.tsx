import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { coachPath, type PublicCoach } from "@/lib/publicSchool";
import { isFounderCoach, orderPublicCoaches, publicCoachTitle } from "@/lib/publicCoaches";
import { coachPhotoUrl } from "@/lib/staffPhoto";

function CoachPhotoCard({ coach }: { coach: PublicCoach }) {
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const image = coachPhotoUrl(coach.profile_photo);
  const title = publicCoachTitle(coach);
  const bio = coach.description?.trim();
  const intro = bio ? bio.split(/\n\s*\n/)[0] : "Get to know the person behind the moves. Explore their current classes.";
  const excerpt = intro.length > 245 ? `${intro.slice(0, 245).replace(/\s+\S*$/, "")}…` : intro;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={`tde-team-photo-card${isFounderCoach(coach) ? " tde-team-founder" : ""}`}
          aria-label={`Meet ${coach.first_name}, ${title}. Open biography`}
          data-preview-hidden={previewDismissed || undefined}
          onMouseEnter={() => setPreviewDismissed(false)}
          onMouseLeave={() => setPreviewDismissed(false)}
          onFocus={() => setPreviewDismissed(false)}
          onKeyDown={(event) => { if (event.key === "Escape") setPreviewDismissed(true); }}
        >
          <span className="tde-team-portrait">
            {image ? <img src={image} alt="" loading="lazy" width="400" height="400" /> : <span className="tde-team-initial" aria-hidden="true">{coach.first_name?.[0]}</span>}
          </span>
          <span className="tde-team-caption">
            <span><strong>{coach.first_name}</strong><span className="tde-team-role">{title}</span></span>
            <span className="tde-team-open" aria-hidden="true"><Plus size={21} /></span>
          </span>
          <span className="tde-team-peek" aria-hidden="true">
            <span>{excerpt}</span>
            <span className="tde-team-peek-link">Open full profile <ArrowUpRight size={17} /></span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="tde-coach-dialog">
        <div className="tde-coach-dialog-layout">
          <div className="tde-coach-dialog-portrait">
            {image ? <img src={image} alt={`${coach.first_name}, ${title}`} width="400" height="400" /> : <span className="tde-team-initial" aria-hidden="true">{coach.first_name?.[0]}</span>}
          </div>
          <div className="tde-coach-dialog-copy">
            <span className="tde-coach-dialog-role">{title}</span>
            <DialogTitle>{coach.first_name}</DialogTitle>
            <DialogDescription>{bio || "A biography hasn't been added yet. You can still explore their current classes below."}</DialogDescription>
            {!!coach.dance_skills?.length && <ul className="tde-coach-dialog-skills" aria-label="Dance styles">{coach.dance_skills.map(skill => <li key={skill}>{skill}</li>)}</ul>}
            <Link to={coachPath(coach)} className="tde-coach-dialog-link">Explore {coach.first_name}'s classes <ArrowUpRight size={18} aria-hidden /></Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** All published coaches, with no carousel or nested scroll area. */
export function CoachPhotoGrid({ coaches }: { coaches: PublicCoach[] }) {
  const ordered = orderPublicCoaches(coaches);
  return (
    <div className={`tde-team-photo-grid${ordered.some(isFounderCoach) ? " tde-team-has-founder" : ""}`}>
      {ordered.map(coach => <CoachPhotoCard key={coach.id} coach={coach} />)}
    </div>
  );
}
