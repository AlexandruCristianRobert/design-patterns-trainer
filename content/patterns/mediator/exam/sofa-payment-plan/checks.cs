using System.Reflection;
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
}
