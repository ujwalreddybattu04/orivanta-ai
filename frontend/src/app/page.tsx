import { SearchBar, QuickActions } from "@/components/search";
import { StarField } from "@/components/common";

export default function HomePage() {
    return (
        <div className="home-page">
            <StarField />
            <div className="home-hero">
                <h1 className="home-title">Orivanta</h1>
                <SearchBar />
                <QuickActions />
            </div>
        </div>
    );
}
