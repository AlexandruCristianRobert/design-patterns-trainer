using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DesignPatterns.Checks;

static class SofaPaymentChecks
{
    // Reads the three fields themselves and the summary line, so both must agree.
    static void Step(PaymentPlan plan, Action action, string said, string expected)
    {
        action();
        var actual = $"{plan.Price.Euros} EUR over {plan.Months.Count} months, {plan.Monthly.Euros} EUR a month";
        Expect.That(actual == expected, "wrongFields", new { step = said, expected, actual });
        var shown = plan.Summary.Text;
        Expect.That(shown == expected, "wrongSummary", new { step = said, expected, actual = shown });
    }

    [Check("price-and-months-work-out-the-monthly-amount")]
    static void PriceAndMonthsWorkOutTheMonthlyAmount()
    {
        var plan = new PaymentPlan();
        Step(plan, () => { }, "opening the form", "0 EUR over 12 months, 0 EUR a month");
        Step(plan, () => plan.Price.Enter(1200), "entering a price of 1200", "1200 EUR over 12 months, 100 EUR a month");
        Step(plan, () => plan.Months.Enter(7), "entering 7 months", "1200 EUR over 7 months, 172 EUR a month");
        Step(plan, () => plan.Price.Enter(999), "entering a price of 999", "999 EUR over 7 months, 143 EUR a month");
        Step(plan, () => plan.Months.Enter(24), "entering 24 months", "999 EUR over 24 months, 42 EUR a month");
    }

    [Check("the-monthly-amount-works-out-the-months")]
    static void TheMonthlyAmountWorksOutTheMonths()
    {
        var plan = new PaymentPlan();
        plan.Price.Enter(1200);
        Step(plan, () => plan.Monthly.Enter(150), "entering 150 a month for 1200", "1200 EUR over 8 months, 150 EUR a month");
        Step(plan, () => plan.Monthly.Enter(70), "entering 70 a month", "1200 EUR over 18 months, 67 EUR a month");
        Step(plan, () => plan.Monthly.Enter(1500), "entering 1500 a month", "1200 EUR over 1 months, 1200 EUR a month");
        Step(plan, () => plan.Price.Enter(600), "then entering a price of 600", "600 EUR over 1 months, 600 EUR a month");
    }

    [Check("months-stay-between-1-and-24")]
    static void MonthsStayBetween1And24()
    {
        var plan = new PaymentPlan();
        plan.Price.Enter(1200);
        Step(plan, () => plan.Monthly.Enter(40), "entering 40 a month for 1200, which would take 30 months", "1200 EUR over 24 months, 50 EUR a month");
        Step(plan, () => plan.Months.Enter(36), "entering 36 months", "1200 EUR over 24 months, 50 EUR a month");
        Step(plan, () => plan.Months.Enter(0), "entering 0 months", "1200 EUR over 1 months, 1200 EUR a month");
        Step(plan, () => plan.Monthly.Enter(0), "entering 0 a month", "1200 EUR over 24 months, 50 EUR a month");
    }

    [Check("the-fields-know-only-the-plan")]
    static void TheFieldsKnowOnlyThePlan() =>
        ExpectNoneHoldsAnother([typeof(PriceField), typeof(MonthsField), typeof(MonthlyField), typeof(SummaryLine)]);

    [Check("no-field-reaches-another-through-the-plan")]
    static void NoFieldReachesAnotherThroughThePlan() =>
        ExpectNoneReachesThrough(typeof(PaymentPlan), [typeof(PriceField), typeof(MonthsField), typeof(MonthlyField), typeof(SummaryLine)]);

    // ---- No part holds another ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No field of a part, or of a class it inherits from, can hold one of the parts: typed as the part, as a class or
    // interface of ours that the part is, or as an array, list or other collection of them. Fields typed object and
    // delegates do not count.
    static void ExpectNoneHoldsAnother(Type[] parts)
    {
        foreach (var part in parts)
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
                foreach (var field in type.GetFields(AnyField))
                    foreach (var other in parts)
                        Expect.That(!Holds(field.FieldType, other), "holdsAnother",
                            new { type = part.Name, field = Shown(field), other = other.Name });
    }

    static bool Holds(Type fieldType, Type part) =>
        fieldType != typeof(object) && !typeof(Delegate).IsAssignableFrom(fieldType)
        && (part.IsAssignableFrom(fieldType)
            || fieldType.Assembly == part.Assembly && fieldType.IsAssignableFrom(part)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part)));

    // The field's name as written: "<Form>k__BackingField" becomes "Form".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;

    // ---- No part reaches another through the hub ----

    // Inside a part, nothing reads a member of the hub that can hold a part (a property or field typed as a part, as a
    // class or interface of ours that a part is, or as a collection of them) through the part's own field or property
    // that holds the hub: `hub.Member`, `this.hub.Member`, `hub!.Member` or `hub?.Member`.
    static void ExpectNoneReachesThrough(Type hub, Type[] parts)
    {
        var held = new HashSet<string>();
        for (var type = hub; type is not null && type != typeof(object); type = type.BaseType)
        {
            foreach (var property in type.GetProperties(AnyField))
                if (parts.Any(p => Holds(property.PropertyType, p))) held.Add(property.Name);
            foreach (var field in type.GetFields(AnyField))
                if (!field.Name.StartsWith('<') && parts.Any(p => Holds(field.FieldType, p))) held.Add(field.Name);
        }

        foreach (var part in parts)
        {
            var receivers = new HashSet<string>();
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
            {
                foreach (var field in type.GetFields(AnyField))
                    if (HoldsHub(field.FieldType, hub)) receivers.Add(Shown(field));
                foreach (var property in type.GetProperties(AnyField))
                    if (HoldsHub(property.PropertyType, hub)) receivers.Add(property.Name);
            }
            if (receivers.Count == 0) continue;

            foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == part.Name))
                foreach (var node in declaration.DescendantNodes())
                {
                    (string? receiver, string? member) = node switch
                    {
                        MemberAccessExpressionSyntax m => (Receiver(m.Expression), m.Name.Identifier.ValueText),
                        ConditionalAccessExpressionSyntax c => (Receiver(c.Expression),
                            c.WhenNotNull.DescendantNodesAndSelf().OfType<MemberBindingExpressionSyntax>().FirstOrDefault()?.Name.Identifier.ValueText),
                        _ => (null, null),
                    };
                    var reaches = receiver is not null && member is not null && receivers.Contains(receiver) && held.Contains(member);
                    Expect.That(!reaches, "reachesThrough", new { type = part.Name, code = $"{receiver}.{member}" });
                }
        }
    }

    // The name a hub is read through: `hub`, `this.hub`, `(hub)` or `hub!`; null for anything else.
    static string? Receiver(ExpressionSyntax expression) => expression switch
    {
        IdentifierNameSyntax i => i.Identifier.ValueText,
        MemberAccessExpressionSyntax { Expression: ThisExpressionSyntax } m => m.Name.Identifier.ValueText,
        ParenthesizedExpressionSyntax p => Receiver(p.Expression),
        PostfixUnaryExpressionSyntax u when u.OperatorToken.ValueText == "!" => Receiver(u.Operand),
        _ => null,
    };

    // A field or property of this type can hold the hub: the hub itself, or a class or interface of ours that it is.
    static bool HoldsHub(Type type, Type hub) =>
        type != typeof(object) && type.Assembly == hub.Assembly && type.IsAssignableFrom(hub);
}
