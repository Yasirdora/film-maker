import Spacer from "../shared/Spacer";
import SectionHeadline from "../shared/SectionHeadline";
import ReversibleTile from "../shared/ReversibleTile";
import { AuteurWriterStage } from "./auteur-writer-stage";

export default function AutomationSection() {
  return (
    <section className="section" aria-label="Auteur, the AI collaborator">
      <Spacer size="R17" />
      <SectionHeadline
        id="auteur"
        gradient="ai"
        eyebrow="New"
        cssVars={{ "--content-max-width": "1090px" }}
        body={
          <p>
            Auteur is a collaborator for filmmakers that analyses your shot list, reviews
            your generations and helps you storyboard.
          </p>
        }
      >
        <b>Auteur</b>, the AI <b>collaborator</b>
      </SectionHeadline>
      <Spacer size="R08" />
      <div className="container-outer container-outer-dark">
        <div className="modules">
          <Spacer size="R07" />
          {/* Script tile — shared video across the flip */}
          <div id="productivity-script" className="container">
            <ReversibleTile
              className="reversible-tile reversible-tile-bg-black reversible-tile-shared-asset"
              frontContent={
                <div className="tile-front tile5050 tile5050-asset-right tile5050-bg-black tile5050-dark tile5050-gradient-ai sm-md-asset-top tile5050-sm-md-text-left tile5050-auteur-floating">
                  <div className="tile5050-layout">
                    <div className="tile5050-content copy-group copy-group-dark">
                      <div className="tile5050-content-eyebrow copy-group-eyebrow eyebrow-tag eyebrow-dark eyebrow-outline eyebrow-size">
                        Auteur AI
                      </div>
                      <h3 className="tile5050-content-title copy-group-title headline2 markdown">
                        Write the <b>next scene</b> with Auteur.
                      </h3>
                    </div>
                    <div className="tile5050-asset type:ImageAsset">
                      <AuteurWriterStage />
                    </div>
                  </div>
                </div>
              }
              backContent={
                <div className="tile-back tile5050 tile5050-asset-right tile5050-bg-black tile5050-dark tile5050-gradient-ai tile5050-sm-md-asset-hidden tile5050-sm-md-text-left tile5050-valign-center tile5050-auteur-floating">
                  <div className="tile5050-layout">
                    <div className="tile5050-content copy-group copy-group-dark">
                      <div className="tile5050-content-eyebrow copy-group-eyebrow eyebrow-tag eyebrow-dark eyebrow-outline eyebrow-size">
                        Auteur AI
                      </div>
                      <h3 className="tile5050-content-title copy-group-title headline3 markdown">
                        <b>From treatment to pitch</b>, with Auteur
                      </h3>
                      <div className="tile5050-content-body copy-group-body body-large">
                        <p>
                          Draft treatments, scenes and shot lists in seconds.
                          Refine tone, format and genre as you go &ndash; so
                          what you hand off reads polished, not first-draft.
                        </p>
                      </div>
                      <div className="tile5050-content-disclaimer copy-group-disclaimer eyebrow-size"></div>
                    </div>
                    {/* Asset slot intentionally empty — the front face's video
                        is shared across both states via .reversible-tile-shared-asset. */}
                    <div className="tile5050-asset type:ImageAsset" aria-hidden="true" />
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>
      <Spacer size="R16" />
    </section>
  );
}
