import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Users from '../models/users.js';
import { sendEmail } from '../utils/Email.js';

// Helper functions
function isMatch(password, confirmPassword) {
    return password === confirmPassword;
}

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validatePassword(password) {
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;
    return re.test(password);
}

// Create refresh token
function createRefreshToken(payload) {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
}

// User sign-up
export const signUp = async (req, res) => {
    try {
        const { personal_id, name, email, password, confirmPassword, address, phone_number } = req.body;
        const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        if (!personal_id || !name || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Please fill in all fields" });
        }

        if (name.length < 3) return res.status(400).json({ message: "Your name must be at least 3 letters long" });

        if (!isMatch(password, confirmPassword)) return res.status(400).json({ message: "Password did not match" });

        if (!validateEmail(email)) return res.status(400).json({ message: "Invalid email" });

        if (!validatePassword(password)) {
            return res.status(400).json({
                message: "Password should be 6 to 20 characters long with at least one number, one lowercase and one uppercase letter"
            });
        }

        const existingUser = await Users.findOne({ "personal_info.email": email });
        if (existingUser) {
            return res.status(400).json({ message: "This email is already registered" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new Users({
            personal_info: {
                binusian_id: personal_id,
                name: name,
                email: email,
                password: hashedPassword,
                address: address || "",
                phone: phone_number || "",
                role: [0]
            }
        });

        await newUser.save();

        await sendEmail(email, "Verify your account", `Your OTP code is: ${otp}`);

        res.status(200).json({
            message: "User registered successfully. Please check your email for the OTP to verify your account.",
            user: {
                id: newUser._id,
                email: newUser.personal_info.email
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// User sign-in
export const signIn = async (req, res) => {
    try {
        console.log("Request body:", req.body);
        const { email, password } = req.body;
        console.log("Extracted email:", email);
        console.log("Extracted password:", password);

        if (!email || !password) {
            console.log("Missing fields - email:", !!email, "password:", !!password);
            return res.status(400).json({ message: "Please fill in all fields" });
        }

        const user = await Users.findOne({ email });
        console.log("Found user:", user ? "Yes" : "No");

        if (!user) return res.status(400).json({ message: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.personal_info.password); 
        console.log("Password match:", isMatch);
        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        const refresh_token = createRefreshToken({ id: user._id });

        const expiry = 24 * 60 * 60 * 1000; // 1 day

        res.cookie('refreshtoken', refresh_token, {
            httpOnly: true,
            path: '/api/user/refresh_token',
            maxAge: expiry,
            expires: new Date(Date.now() + expiry)
        });

        res.json({
            message: "Sign In successfully!",
            user: {
                id: user._id,
                name: user.personal_info.name,
                email: user.personal_info.email
            }
        });

    } catch (error) {
        console.log("Error in signIn:", error);
        return res.status(500).json({ message: error.message });
    }
};

// user information
export const userInfor = async (req, res) => {
    try {
        const userId = req.user.id
        const userInfor = await Users.findById(userId).select("-password")

        res.json(userInfor)
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
// delete user
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await Users.findByIdAndDelete(id);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// verify email
export const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Please provide email and OTP" });
        }

        const user = await Users.findOne({ 
            "personal_info.email": email,
            otp: otp,
            otpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // Update user verification status
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ 
            message: "Email verified successfully",
            user: {
                id: user._id,
                email: user.personal_info.email,
                name: user.personal_info.name
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// get all users
export const getAllUsers = async (req, res) => {
    try {
        const users = await Users.find().select("-password");
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// update user
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, address, phone_number, social_links } = req.body;

        // Don't allow email updates through this route for security
        const updateData = {
            ...(name && { "personal_info.name": name }),
            ...(address && { "personal_info.address": address }),
            ...(phone_number && { "personal_info.phone": phone_number }),
            ...(social_links && { social_links })
        };

        const updatedUser = await Users.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User updated successfully",
            user: updatedUser
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

