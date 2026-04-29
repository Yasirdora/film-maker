import Spacer from "../shared/Spacer";
import SectionHeadline from "../shared/SectionHeadline";
import { FilmmakerIcon } from "../shared/FilmmakerIcon";
import StudioMockupTile from "./StudioMockupTile";

export default function NextGenAISection() {
  return (
    <section className="section" aria-label="Next Generation of Filmmaking">
      <Spacer size="R17" />
      <SectionHeadline
        id="nextgen-ai"
        gradient="ai"
        icon={<FilmmakerIcon width={72} height={72} />}
        cssVars={{ "--title-max-width": "780px" }}
      >
        <b>Next Generation</b> of Filmmaking
      </SectionHeadline>
      <Spacer size="R12" />
      <div className="container-outer container-outer-dark">
        <div className="modules">
          {/* Tile 1: Filmmaker Studio mockup — tile flip button repurposed
              to toggle desktop/mobile preview (no back face). */}
          <div id="tackle-complex-projects" className="container">
            <StudioMockupTile />
          </div>
        </div>
      </div>
      <Spacer size="R10" />
    </section>
  );
}
