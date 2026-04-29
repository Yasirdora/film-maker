import Spacer from "../shared/Spacer";
import SectionHeadline from "../shared/SectionHeadline";
import SpatialCarousel from "./SpatialCarousel";
import FeatureAccordion from "./FeatureAccordion";

export default function ProductivitySection() {
  return (
    <section className="section" aria-label="Shorts & Social spots">
      <Spacer size="R17" />
      <SectionHeadline
        id="productivity"
        gradient="apps"
        cssVars={{ "--title-max-width": "850px" }}
        body={<p>Generated with Filmmaker Network</p>}
      >
        Shorts &amp; Social spots
      </SectionHeadline>
      <SpatialCarousel />
      <Spacer size="R12" />
      <div className="container-outer container-outer-dark">
        <div className="modules">
          <SectionHeadline id="script-to-screen" as="h3" size="2">
            <span className="weight-regular">Script to</span> Screen
          </SectionHeadline>
          <Spacer size="R06" />
          <div id="features-and-analyze" className="container">
            <FeatureAccordion />
          </div>
        </div>
      </div>
      <Spacer size="R10" />
    </section>
  );
}
