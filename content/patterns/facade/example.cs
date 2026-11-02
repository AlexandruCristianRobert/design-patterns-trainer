// The page knows only the desk. The desk knows the four steps and their order.
var desk = new EnrolmentDesk(new SeatRegister(), new PaymentGateway(), new LearnerAccounts(), new WelcomeMailer());
var page = new SignUpPage(desk);
page.Submit("Ana", "Pottery");

public class SeatRegister
{
    public void Reserve(string course) => Console.WriteLine($"Reserved a seat in {course}");
}

public class PaymentGateway
{
    public void Charge(string student, string course) => Console.WriteLine($"Charged {student} for {course}");
}

public class LearnerAccounts
{
    public void AddCourse(string student, string course) => Console.WriteLine($"Added {course} to {student}'s account");
}

public class WelcomeMailer
{
    public void Send(string student, string course) => Console.WriteLine($"Welcome mail for {course} sent to {student}");
}

public class EnrolmentDesk(SeatRegister seats, PaymentGateway payments, LearnerAccounts accounts, WelcomeMailer mailer)
{
    public void Enrol(string student, string course)
    {
        seats.Reserve(course);
        payments.Charge(student, course);
        accounts.AddCourse(student, course);
        mailer.Send(student, course);
    }
}

public class SignUpPage(EnrolmentDesk desk)
{
    public void Submit(string student, string course) => desk.Enrol(student, course);
}
