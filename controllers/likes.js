import { db } from '../db.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export const sendLike = (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "You are not singin!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { postId } = req.params;
        const { commentId } = req.body;

        if (postId) {
            const q = "INSERT INTO likes(`id`, `postId`, `username`) VALUES(?);";

            const values = [
                uuidv4(),
                postId,
                userInfo.username
            ];

            db.query(q, [values], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({ message: "Post has been liked!" });
            });
        };

        if (commentId) {
            const q = "INSERT INTO likes(`id`, `commentId`, `username`) VALUES(?);";

            const values = [
                uuidv4(),
                commentId,
                userInfo.username
            ];

            db.query(q, [values], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({ message: "Comment has been liked!" });
            });
        };
    });
};

export const disLike = (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "You are not singin!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { postId } = req.params;
        const { commentId } = req.body;

        if (postId) {
            const q = "DELETE FROM likes WHERE postId = ? AND username = ?;";

            db.query(q, [postId, userInfo.username], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({ message: "Post has been unliked!" });
            });
        };

        if (commentId) {
            const q = "DELETE FROM likes WHERE commentId = ? AND username = ?;";

            db.query(q, [commentId, userInfo.username], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({ message: "Comment has been unliked!" });
            });
        };
    });
};

export const getLike = (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "You are not singin!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { postId } = req.params;
        const { commentId } = req.body;

        if (postId) {
            const q = "SELECT * FROM likes WHERE postId = ? AND username = ?"

            db.query(q, [postId, userInfo.username], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json(data);
            })
        }

        if (commentId) {
            const q = "SELECT * FROM likes WHERE commentId = ? AND username = ?"

            db.query(q, [commentId, userInfo.username], (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json(data);
            })
        }
    })

}

export const getLikes = (req, res) => {
    const { username } = req.params;
    const q = "SELECT COUNT(postId) AS likes, users.username AS username FROM likes JOIN posts ON posts.id = likes.postId JOIN users ON users.username = posts.username GROUP BY users.username HAVING users.username = ? ";
    db.query(q, [username], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}

export const getPostLikes = (req, res) => {
    const { postId } = req.params;
    const q = "SELECT users.id, users.username, users.name, users.userImg FROM likes JOIN users ON users.username = likes.username WHERE postId = ?";

    db.query(q, [postId], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}


