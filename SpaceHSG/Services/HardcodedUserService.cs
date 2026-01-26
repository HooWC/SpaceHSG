namespace SpaceHSG.Services
{
    public static class HardcodedUserService
    {
        public static bool ValidateUser(
            string username,
            string password,
            out string role
        )
        {
            role = "";

            // Admin account
            if (username == "administrator" &&
                password == "hsonlinehsgroup1234%")
            {
                role = "Admin";
                return true;
            }

            // Normal user account
            if (username == "user" &&
                password == "hsonline")
            {
                role = "User";
                return true;
            }

            return false;
        }
    }
}
