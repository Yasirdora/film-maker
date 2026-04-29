import Button from "../shared/Button";
import { FilmmakerLogo } from "../shared/FilmmakerLogo";

export default function AppDownload() {
  return (
    <div className="app-download-module container">
      <div className="app-download-layout">
        <div className="app-download-content">
          <h2 className="app-download-title headline2">
            Start creating with
          </h2>
          <FilmmakerLogo className="app-download-logo-wordmark" />
          <p className="app-download-subtitle size-body-alt regular">
            Open the studio in your browser &ndash; no install, no waitlist.
            A mobile companion app is on the roadmap.
          </p>
        </div>
        <div className="app-download-cta">
          <Button href="#" variant="primary" icon="arrow">
            Launch the studio
          </Button>
        </div>
      </div>
    </div>
  );
}
