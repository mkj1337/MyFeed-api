import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const signup = (req, res) => {
    const { email, name, username, password } = req.body;

    if (!email.length || !name.length || !username.length || !password.length) {
        return res.status(409).json({
            message: "Fill up all sign up inputs properly!",
        });
    };

    const generateVerificationToken = () => {
        return crypto.randomBytes(32).toString('hex');
    }

    const q = "SELECT * FROM users WHERE username = ?;";

    db.query(q, [username], (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length) return res.status(409).json({
            message: 'User with this username already exists!',
        });


        const q = "INSERT INTO users(`id`, `username`, `name`, `email`, `password`, `email_verify`, `verify`, `createdAt`) VALUES(?);";

        if (password.length < 5) return res.status(409).json({
            message: "Too short password!",
        });

        const verificationToken = generateVerificationToken();

        const mailOptions = {
            from: process.env.VERIFY_EMAIL,
            to: email,
            subject: 'MyFeed verify your account!',
            html: ` 
            <p>Click the following link to verify your email:</p>
            <a href="https://devdomain.site/auth/verify?token=${verificationToken}">Verify Email</a>
            `
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPass = bcrypt.hashSync(password, salt);

        const values = [
            uuidv4(),
            username,
            name,
            email,
            hashedPass,
            verificationToken,
            false,
            dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        ];

        db.query(q, [values], async (err, data) => {
            if (err) return res.status(500).json(err);

            await sendEmail(mailOptions);

            return res.status(200).json({
                message: 'User has been created successfully! Verify yout account on email!',
            });
        });
    });
};

export const verify = async (req, res) => {
    const { token } = req.query;

    const user = getUserByVerificationToken(token);

    if (user) {
        // Mark the user's email as verified in the database
        markEmailAsVerified(user.email);
        res.redirect('?verified=success');
    } else {
        res.redirect('?verified=failed');
    }
}

export const signin = (req, res) => {
    const { email, password } = req.body;

    if (!email.length || !password.length) return res.status(409).json({ message: "Fill up all sign in inputs properly!" });

    const q = "SELECT * FROM users WHERE email = ? AND verify = true;";

    db.query(q, [email], (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length === 0) return res.status(404).json({ message: 'User not found!' });

        const comparePass = bcrypt.compareSync(req.body.password, data[0].password);

        if (!comparePass) return res.status(400).json({ message: 'Wrong password or email!' });

        const token = jwt.sign({ id: data[0].id, username: data[0].username }, process.env.JWT_SECRET_KEY);

        const { password, ...others } = data[0];

        res.cookie('access_token', token, {
            httpOnly: true,
            cookie: { domain: "devdomain.site" }
        }).status(200).json(others);
    });
};

export const signout = (req, res) => {
    res.clearCookie('access_token', {
        secure: true,
        sameSite: 'none'
    }).status(200).json({ message: 'Signed Out!' });
};

const getUserByVerificationToken = (token) => {
    const q = "SELECT * FROM users WHERE email_verify=?;";

    db.query(q, token, (err, data) => {
        if (data) {
            // User with the verification token found
            return data;
        } else {
            // User not found, return null or an error
            return null;
        };
    });
};

const markEmailAsVerified = (username) => {
    const q = `UPDATE users SET verify=true WHERE username=?;`;

    db.query(q, username, (err, data) => {
        if (err) return res.status(500).json({ verify: failed });

        return res.status(200).json({ verified: success })
    })
}

const sendEmail = (options) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.VERIFY_EMAIL,
            pass: process.env.VERIFY_EMAIL_PASSWORD
        }
    })

    return new Promise((resolve, reject) => {
        transporter.sendMail(options, (error, info) => {
            if (error) {
                reject(err)
            } else {
                resolve(info)
            }
        })
    })
}