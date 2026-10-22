namespace DesignPatterns.Checks;

public static class Code
{
    public static TypeFacts Type(string name)
    {
        var type = CheckContext.Current.Assembly.GetTypes()
            .FirstOrDefault(t => t.Name == name || t.FullName == name);
        if (type is null) Expect.Fail("typeNotFound", new { type = name });
        return new TypeFacts(type);
    }
}
