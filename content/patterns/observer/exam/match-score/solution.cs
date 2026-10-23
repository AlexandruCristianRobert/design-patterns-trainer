var match = new Match("Rapid", "Dinamo");
var stadium = new StadiumBoard();
var app = new PhoneApp();
match.AddScreen(stadium);
match.AddScreen(app);

match.Score("Rapid");
match.Score("Dinamo");

match.RemoveScreen(app);
match.Score("Rapid");

public interface IScoreScreen
{
    void ShowScore(int homeGoals, int awayGoals);
}

public class Match(string home, string away)
{
    private readonly List<IScoreScreen> _screens = [];
    private int _homeGoals;
    private int _awayGoals;

    public void AddScreen(IScoreScreen screen) => _screens.Add(screen);

    public void RemoveScreen(IScoreScreen screen) => _screens.Remove(screen);

    public void Score(string team)
    {
        if (team == home) _homeGoals++;
        else if (team == away) _awayGoals++;
        else return;

        // Loop over a copy: a screen may remove itself while showing the score.
        foreach (var screen in _screens.ToList())
            screen.ShowScore(_homeGoals, _awayGoals);
    }
}

public class StadiumBoard : IScoreScreen
{
    public void ShowScore(int homeGoals, int awayGoals) => Console.WriteLine($"BOARD  {homeGoals} : {awayGoals}");
}

public class PhoneApp : IScoreScreen
{
    public void ShowScore(int homeGoals, int awayGoals) => Console.WriteLine($"app: goal! now {homeGoals}-{awayGoals}");
}
