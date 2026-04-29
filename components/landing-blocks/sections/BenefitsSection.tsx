import Spacer from "../shared/Spacer";
import SectionHeadline from "../shared/SectionHeadline";
import ReversibleTile from "../shared/ReversibleTile";
import Button from "../shared/Button";
import Footnote from "../shared/Footnote";
import ResponsiveImage from "../shared/ResponsiveImage";

export default function BenefitsSection() {
  return (
    <section id="benefits" className="section" aria-label="Behind the models. A film crew.">
      <Spacer size="R17" />
      <SectionHeadline>
        <span className="weight-regular">Behind the models.</span>{" "}
        <b>A film crew.</b>
      </SectionHeadline>
      <Spacer size="R08" />
      <div className="container-outer container-outer-dark">
        <div className="modules">
          <div id="home-premium" className="container">
            <ReversibleTile
              className="reversible-tile reversible-tile-bg-black reversible-tile-shared-asset"
              frontContent={
                <div className="tile-front tile5050 tile5050-asset-left tile5050-bg-black tile5050-dark tile5050-asset-align-center">
                  <div className="tile5050-layout">
                    <div className="tile5050-content copy-group copy-group-dark">
                      <div className="tile5050-content-eyebrow copy-group-eyebrow eyebrow-tag eyebrow-dark eyebrow-outline eyebrow-size">
                        Filmmaker Academy
                      </div>
                      <h3 className="tile5050-content-title copy-group-title headline2 markdown">
                        <b>Hands-on support</b>{" "}
                        <span className="weight-regular">
                          for advanced control and fine-tuning.
                        </span>
                        <Footnote styled id="plans" />
                      </h3>
                    </div>
                    <div className="tile5050-asset type:ImageAsset">
                      <ResponsiveImage
                        alt="A Filmmaker Academy lesson tile"
                        sources={[
                          {
                            breakpoint: "all",
                            src: "/assets/filmmaker academy.jpg",
                            srcSet2x: "/assets/filmmaker academy.jpg",
                            srcSet1x: "/assets/filmmaker academy.jpg",
                            width: 1550,
                            height: 1210,
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              }
              backContent={
                <div className="tile-back tile5050 tile5050-asset-left tile5050-bg-black tile5050-dark tile5050-sm-md-text-left tile5050-sm-md-asset-hidden tile5050-valign-center">
                  <div className="tile5050-layout">
                    <div className="tile5050-content copy-group copy-group-dark">
                      <div className="tile5050-content-body copy-group-body body">
                        <p>
                          Direct support, fine-tuning sessions, and in-depth
                          guides on advanced control — for filmmakers pushing
                          generations to production-ready results.
                        </p>
                      </div>
                      <ul className="copy-group-buttons button-group button-align-start button-mobile-align-start unstyled-list">
                        <li>
                          <Button href="#" icon="arrow">
                            Learn more
                          </Button>
                        </li>
                      </ul>
                      <div className="tile5050-content-disclaimer copy-group-disclaimer eyebrow-size">
                        <p>
                          Only available with a Creator or Studio plan.
                        </p>
                      </div>
                    </div>
                    {/* Asset slot intentionally empty — the front face's image
                        is shared across both states via .reversible-tile-shared-asset. */}
                    <div className="tile5050-asset type:ImageAsset" aria-hidden="true" />
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>
      <Spacer size="R10" />
    </section>
  );
}
