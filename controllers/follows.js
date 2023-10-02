import { db } from '../db.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export const sendFollow = (req, res) => {
    const token = req.cookies.access_token;

    if (!token) return res.status(401).json({ message: "You are not Sign in!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { username } = req.params;
        const { followerUsername } = req.body;

        const q = "INSERT INTO followers(`id`,`followedUsername`, `followerUsername`) VALUES(?);";

        const values = [
            uuidv4(),
            username,
            followerUsername
        ];

        db.query(q, [values], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json({ message: "User has been followed!" });
        })
    })
}

export const unFollow = (req, res) => {
    const token = req.cookies.access_token;

    if (!token) return res.status(401).json({ message: "You are not Sign in!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { username } = req.params;
        const { followerUsername } = req.body;

        const q = "DELETE FROM followers WHERE followedUsername = ? AND followerUsername = ?";

        db.query(q, [username, followerUsername], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json({ message: "User has been unfollowed!" });
        })
    })
}

export const getFollow = (req, res) => {
    const { username } = req.params;
    const { followerUsername } = req.body;

    const q = "SELECT * FROM followers WHERE followedUsername = ? AND followerUsername = ?";

    db.query(q, [username, followerUsername], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}

export const getFollowers = (req, res) => {
    const { followerUsername } = req.params;
    const q = "SELECT users.id, name, username, userImg FROM followers JOIN users ON users.username = followers.followerUsername WHERE followedUsername = ?;";

    db.query(q, [followerUsername], (err, data) => {
        if (err) res.status(500).json(err);

        return res.status(200).json(data);
    })
}