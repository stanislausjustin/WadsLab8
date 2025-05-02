import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
    });

    await transporter.sendMail({
        from: `"Verify Your Account" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    });
};