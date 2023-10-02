import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const signup = (req, res) => {
    const { email, name, username, password } = req.body;

    if (!email.length || !name.length || !username.length || !password.length) {
        return res.status(409).json({
            message: "Fill up all sign up inputs properly!",
        });
    };

    const q = "SELECT * FROM users WHERE username = ?;";

    db.query(q, [username], (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length) return res.status(409).json({
            message: 'User with this username already exists!',
        });

        const q = "INSERT INTO users(`id`, `username`, `name`, `email`, `password`, `createdAt`) VALUES(?);";

        if (password.length < 5) return res.status(409).json({
            message: "Too short password!",
        });

        const salt = bcrypt.genSaltSync(10);
        const hashedPass = bcrypt.hashSync(password, salt);

        const values = [
            uuidv4(),
            username,
            name,
            email,
            hashedPass,
            dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        ];

        db.query(q, [values], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json({
                message: 'User has been created successfully!',
            });
        });
    });
};

export const signin = (req, res) => {
    const { email, password } = req.body;

    if (!email.length || !password.length) return res.status(409).json({ message: "Fill up all sign in inputs properly!" });

    const q = "SELECT * FROM users WHERE email = ?;";

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