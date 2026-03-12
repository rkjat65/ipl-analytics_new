import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TeamComparisonInput from "@/components/TeamComparisonInput";

describe("TeamComparisonInput", () => {
  const mockTeams = ["Chennai Super Kings", "Mumbai Indians", "Kolkata Knight Riders"];
  const mockCallback = (t1: string, t2: string) => {};

  it("renders team selects", () => {
    render(
      <TeamComparisonInput
        teams={mockTeams}
        onTeamsChange={mockCallback}
      />
    );

    const inputs = screen.getAllByPlaceholderText("Search team...");
    expect(inputs).toHaveLength(2);
  });

  it("filters teams based on input", () => {
    render(
      <TeamComparisonInput
        teams={mockTeams}
        onTeamsChange={mockCallback}
      />
    );

    const firstInput = screen.getAllByPlaceholderText("Search team...")[0];
    fireEvent.change(firstInput, { target: { value: "Chennai" } });

    // Should show dropdown with filtered teams
    expect(screen.getByText("Chennai Super Kings")).toBeInTheDocument();
  });

  it("disables inputs when loading", () => {
    render(
      <TeamComparisonInput
        teams={mockTeams}
        onTeamsChange={mockCallback}
        isLoading={true}
      />
    );

    const inputs = screen.getAllByPlaceholderText("Search team...");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
});

describe("SeasonComparisonInput", () => {
  const mockSeasons = ["2015", "2016", "2017", "2018"];
  const mockCallback = (s1: string, s2: string) => {};

  it("renders season selects", () => {
    const { SeasonComparisonInput } = require("@/components/SeasonComparisonInput");
    render(
      <SeasonComparisonInput
        seasons={mockSeasons}
        onSeasonsChange={mockCallback}
      />
    );

    const selects = screen.getAllByDisplayValue("Select season...");
    expect(selects).toHaveLength(2);
  });

  it("shows all seasons in dropdown", () => {
    const { SeasonComparisonInput } = require("@/components/SeasonComparisonInput");
    render(
      <SeasonComparisonInput
        seasons={mockSeasons}
        onSeasonsChange={mockCallback}
      />
    );

    mockSeasons.forEach((season) => {
      expect(screen.getByText(season)).toBeInTheDocument();
    });
  });
});
