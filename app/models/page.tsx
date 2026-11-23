import {CTA,ModelGrid,PageIntro} from '../../components/sections';
export const metadata={title:'Models'};
export default function Models(){return <><PageIntro index="LIVE MODEL LIBRARY" title="The right voice capability for every idea." desc="Discover actual administrator-enabled capabilities and their documented integration endpoints."/><section className="container section section-tight"><ModelGrid/><p className="center-note">Only enabled database records are displayed. Actual inference requires deployed, validated model weights.</p></section><CTA label="Find your starting point."/></>}
