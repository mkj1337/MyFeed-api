import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

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
            <a href="https://devdomain.site/api/auth/verify?token=${verificationToken}">Verify Email</a>
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
            0,
            dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        ];

        db.query(q, [values], async (err, data) => {
            if (err) return res.status(500).json(err);

            sendEmail(mailOptions);

            return res.status(200).json({
                message: 'User has been created successfully! Verify yout account on email!',
            });
        });
    });
};

export const verify = (req, res) => {
    const { token } = req.query;

    const q = "SELECT * FROM users WHERE email_verify=?;";

    db.query(q, [token], async (err, results) => {
        if (err) {
            console.error(err);
            return res.redirect('/signin?verified=failed');
        }

        if (results.length > 0) {
            const username = results[0].username; // Assuming 'username' is the correct field

            try {
                await markEmailAsVerified(username);
                console.log('Email verified successfully');

                res.redirect('/signin?verified=success');
            } catch (error) {
                console.error(error);
                res.redirect('/signin?verified=failed');
            }
        } else {
            res.redirect('/signin?verified=failed');
        }
    });
};

export const signin = (req, res) => {
    const { email, password } = req.body;

    if (!email.length || !password.length) return res.status(409).json({ message: "Fill up all sign in inputs properly!" });

    const q = "SELECT * FROM users WHERE email = ?;";

    db.query(q, [email], async (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length === 0) return res.status(404).json({ message: 'User not found!' });

        const comparePass = bcrypt.compareSync(req.body.password, data[0].password);

        if (!comparePass) return res.status(400).json({ message: 'Wrong password or email!' });

        const verified = await checkIfUserIsVerified(email);

        if (verified.length === 0) return res.status(409).json({ message: 'Verify your account by email!' });

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

const checkIfUserIsVerified = (email) => {
    const q = "SELECT * FROM users WHERE email=? AND verify=1;";

    return new Promise((resolve, reject) => {
        db.query(q, [email], (err, result) => {
            if (err) {
                reject({ message: err });
            } else {
                resolve(result);
            }
        });
    })
}

const markEmailAsVerified = (username) => {
    const q = "UPDATE users SET verify=1 WHERE username=?;";

    return new Promise((resolve, reject) => {
        db.query(q, [username], (err, data) => {
            if (err) {
                console.error(err);
                reject({ verified: 'failed' });
            } else {
                resolve({ verified: 'success' });
            }
        });
    });
};

const sendEmail = (options) => {
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.VERIFY_EMAIL,
            pass: process.env.VERIFY_EMAIL_PASSWORD
        }
    })


    transporter.sendMail(options, (error, info) => {
        if (error) console.log(error);
        if (info) console.log(info)
    })
}

cron.schedule('*/5 * * * *', async () => {
    deleteUnverifiedAccounts((err, data) => {
        if (err) {
            console.error('Error in cron job:', err);
        } else {
            console.log('Cron job executed successfully:', data);
        }
    });
});

const deleteUnverifiedAccounts = (callback) => {
    try {
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

        const q = "DELETE FROM users WHERE verify = 0 AND createdAt <= ?;";

        db.query(q, [fiveMinutesAgo], (err, data) => {
            if (err) {
                console.error('Error deleting unverified accounts:', err);
                return callback(err, null);
            }

            console.log(`Deleted ${data.affectedRows} unverified accounts`);
            return callback(null, data);
        });
    } catch (error) {
        console.error('Error deleting unverified accounts:', error);
        callback(error, null);
    }
};